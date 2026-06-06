<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { compile, lex, parse, check, parseCapabilityManifest } from "@kumikijs/compiler";
// The prebuilt runtime bundle, inlined as a string so generated apps are
// fully self-contained and runnable inside the preview iframe.
import runtimeBundle from "@kumikijs/runtime/bundle?raw";

type Diag = { code: string; kind: string; message: string; line: number; col: number };

// Load every feature example at build time so the playground ships with a
// browsable catalog. Sources live in packages/examples (repo root is ../../..).
const exampleModules = import.meta.glob("../../../packages/examples/features/*.kumiki", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const examples = Object.entries(exampleModules)
  .map(([path, source]) => ({ name: path.split("/").pop() ?? path, source }))
  .sort((a, b) => a.name.localeCompare(b.name));

// The examples directory ships a `kumiki.caps.json` registering project-specific
// capabilities (e.g. telemetry.track for 27-custom-capability). The CLI resolves
// it from disk; here we load it at build time and pass the registered names to
// check()/compile() so those examples typecheck instead of failing E0302.
const capsModules = import.meta.glob(
  "../../../packages/examples/features/kumiki.caps.json",
  { query: "?raw", import: "default", eager: true },
) as Record<string, string>;

const capsRaw = Object.values(capsModules)[0];
const capsParsed = capsRaw ? parseCapabilityManifest(JSON.parse(capsRaw)) : null;
const capabilities: string[] = capsParsed?.ok ? capsParsed.manifest.capabilities : [];

const DEFAULT_SOURCE =
  examples.find((e) => e.name.startsWith("01"))?.source ??
  'slot count : Int = 0\n\nreducer inc on=ui.click(IncBtn) do= count := count + 1\n\ntile IncBtn = button(text="+1", onClick=inc)\ntile App = column(heading("Count: " + count.show), IncBtn)\n\napp Playground\n    caps   = []\n    routes = {"/" -> App, "/404" -> App}\n    init   = []\n';

const source = ref(DEFAULT_SOURCE);
const diagnostics = shallowRef<Diag[]>([]);
const srcdoc = ref("");
const selected = ref("");

function diagnose(src: string): Diag[] {
  try {
    const program = parse(lex(src));
    return check(program, { capabilities }).map((e) => ({
      code: e.code,
      kind: e.kind,
      message: e.message,
      line: e.pos.line,
      col: e.pos.col,
    }));
  } catch (e) {
    const pe = e as { message?: string; pos?: { line: number; col: number } };
    return [
      {
        code: "E0000",
        kind: "parse-error",
        message: pe.message ?? String(e),
        line: pe.pos?.line ?? 0,
        col: pe.pos?.col ?? 0,
      },
    ];
  }
}

function buildPreview(src: string): void {
  const diags = diagnose(src);
  diagnostics.value = diags;
  if (diags.length > 0) {
    srcdoc.value = "";
    return;
  }
  const result = compile(src, {
    runtimeSpecifier: "",
    bundle: true,
    readRuntimeBundle: () => runtimeBundle,
    capabilities,
  });
  if (result.kind === "fail") {
    diagnostics.value = result.errors.map((e) => ({
      code: e.code,
      kind: e.kind,
      message: e.message,
      line: e.pos.line,
      col: e.pos.col,
    }));
    srcdoc.value = "";
    return;
  }
  // The preview iframe is a sandboxed srcdoc (opaque origin, no real path, no
  // network). Configure the embedding seams before the auto-mounting module runs:
  //  - memory router (#36) so routing examples (18/23) initialise at "/" and
  //    navigate instead of falling to /404;
  //  - a deterministic http.get provider (#38) so the HTTP showcase (19) serves
  //    its /api/quote offline and demonstrates the SUCCESS path. Both use the
  //    runtime's own seams — no fetch patching, no sandbox weakening.
  const preamble = `globalThis.__kumikiMount = { router: "memory" };
globalThis.__kumikiProviders = {
  "http.get": (input) => {
    const url = (input && input.url) || "";
    if (url.indexOf("/api/quote") !== -1) {
      return { kind: "ok", value: { text: "Make it work, make it right, make it fast.", author: "Kent Beck" } };
    }
    return { kind: "err", value: { message: "no demo backend for " + url } };
  },
};`;
  srcdoc.value = `<!doctype html><html><head><meta charset="utf-8">
<style>body{font-family:system-ui,sans-serif;margin:0;padding:16px}</style></head>
<body><div id="root"></div>
<script>${preamble}<\/script>
<script type="module">${result.js}<\/script></body></html>`;
}

let timer: ReturnType<typeof setTimeout> | undefined;
watch(
  source,
  (src) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => buildPreview(src), 250);
  },
  { immediate: false },
);

function loadExample(name: string): boolean {
  const ex = examples.find((e) => e.name === name);
  if (!ex) return false;
  source.value = ex.source;
  buildPreview(ex.source);
  return true;
}

watch(selected, (name) => {
  if (name) loadExample(name);
});

const ok = computed(() => diagnostics.value.length === 0 && srcdoc.value.length > 0);

// --- WebMCP: expose the playground as tools for in-browser AI agents ---
let abort: AbortController | undefined;
function registerWebMcpTools(): void {
  const mc = (navigator as unknown as { modelContext?: WebMcp }).modelContext;
  if (!mc?.registerTool) return;
  abort = new AbortController();
  const opts = { signal: abort.signal };

  mc.registerTool(
    {
      name: "kumiki_compile",
      description:
        "Compile the given Kumiki source. Returns ok plus generated JS size, or a list of diagnostics (codes per spec/errors.md).",
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: "object",
        properties: { source: { type: "string", description: "Kumiki source text" } },
        required: ["source"],
      },
      execute: (input: Record<string, unknown>) => {
        const src = String(input["source"] ?? "");
        const diags = diagnose(src);
        if (diags.length > 0) return { ok: false, diagnostics: diags };
        const r = compile(src, {
          runtimeSpecifier: "",
          bundle: true,
          readRuntimeBundle: () => runtimeBundle,
          capabilities,
        });
        return r.kind === "ok"
          ? { ok: true, jsBytes: r.js.length }
          : { ok: false, diagnostics: r.errors };
      },
    },
    opts,
  );

  mc.registerTool(
    {
      name: "kumiki_list_examples",
      description: "List the feature examples available in the playground.",
      annotations: { readOnlyHint: true },
      inputSchema: { type: "object", properties: {} },
      execute: () => examples.map((e) => e.name),
    },
    opts,
  );

  mc.registerTool(
    {
      name: "kumiki_load_example",
      description: "Load a named feature example into the playground editor and preview it.",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string", description: "Example file name, e.g. 07-list.kumiki" } },
        required: ["name"],
      },
      execute: (input: Record<string, unknown>) => {
        const name = String(input["name"] ?? "");
        return loadExample(name) ? `loaded ${name}` : `not found: ${name}`;
      },
    },
    opts,
  );

  mc.registerTool(
    {
      name: "kumiki_set_source",
      description: "Replace the playground editor's source with the given Kumiki code and preview it.",
      inputSchema: {
        type: "object",
        properties: { source: { type: "string" } },
        required: ["source"],
      },
      execute: (input: Record<string, unknown>) => {
        const src = String(input["source"] ?? "");
        source.value = src;
        buildPreview(src);
        return diagnostics.value.length === 0 ? "ok" : JSON.stringify(diagnostics.value);
      },
    },
    opts,
  );
}

onMounted(() => {
  buildPreview(source.value);
  registerWebMcpTools();
});
onBeforeUnmount(() => abort?.abort());

interface WebMcpTool {
  name: string;
  description: string;
  inputSchema?: object;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: Record<string, unknown>) => unknown;
}
interface WebMcp {
  registerTool(tool: WebMcpTool, options?: { signal?: AbortSignal }): void;
}
</script>

<template>
  <div class="sp">
    <div class="sp-bar">
      <select v-model="selected" aria-label="Choose an example">
        <option value="">Choose an example…</option>
        <option v-for="e in examples" :key="e.name" :value="e.name">{{ e.name }}</option>
      </select>
      <span class="sp-status" :class="ok ? 'ok' : 'err'">
        {{ ok ? "✓ Compiled" : diagnostics.length ? "✗ Diagnostics" : "…" }}
      </span>
    </div>
    <div class="sp-grid">
      <textarea
        v-model="source"
        class="sp-editor"
        spellcheck="false"
        aria-label="Kumiki source"
      ></textarea>
      <div class="sp-preview">
        <iframe v-if="ok" :srcdoc="srcdoc" title="preview" sandbox="allow-scripts"></iframe>
        <ul v-else-if="diagnostics.length" class="sp-diags">
          <li v-for="(d, i) in diagnostics" :key="i">
            <code>{{ d.code }}</code> {{ d.message }}
            <span class="sp-pos">({{ d.line }}:{{ d.col }})</span>
          </li>
        </ul>
        <p v-else>…</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sp { border: 1px solid var(--vp-c-divider); border-radius: 8px; overflow: hidden; }
.sp-bar {
  display: flex; align-items: center; gap: 12px;
  padding: 8px 12px; background: var(--vp-c-bg-soft); border-bottom: 1px solid var(--vp-c-divider);
}
.sp-status.ok { color: var(--vp-c-green-1); }
.sp-status.err { color: var(--vp-c-red-1); }
.sp-grid { display: grid; grid-template-columns: 1fr 1fr; min-height: 360px; }
.sp-editor {
  width: 100%; border: 0; resize: vertical; padding: 12px;
  font-family: var(--vp-font-family-mono); font-size: 13px; line-height: 1.5;
  background: var(--vp-c-bg); color: var(--vp-c-text-1); border-right: 1px solid var(--vp-c-divider);
}
.sp-preview { background: #fff; overflow: auto; }
.sp-preview iframe { width: 100%; height: 100%; min-height: 360px; border: 0; }
.sp-diags { margin: 0; padding: 12px 12px 12px 28px; color: var(--vp-c-red-1); }
.sp-diags code { color: var(--vp-c-red-1); }
.sp-pos { color: var(--vp-c-text-2); }
@media (max-width: 768px) { .sp-grid { grid-template-columns: 1fr; } }
</style>
