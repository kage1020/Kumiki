import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compile } from "@strand/compiler";
import { nodeRuntimeBundleReader } from "@strand/compiler/node";
import type { AppShape } from "@strand/runtime";

const here = dirname(fileURLToPath(import.meta.url));
// Drop temp bundles inside the project tree so Vitest's resolver allows them.
const TMP_ROOT = resolve(here, "../../test-tmp");
mkdirSync(TMP_ROOT, { recursive: true });

/**
 * Compile a .strand file as a self-contained bundle, write it to a temp file,
 * and dynamic-import it. Sets `globalThis.__strandApp` and returns it.
 *
 * Each call uses a fresh temp file + query-string cache-bust so tests don't
 * share module state.
 */
export async function buildAndLoad(strandPath: string, rootId: string): Promise<AppShape> {
  const src = readFileSync(strandPath, "utf8");
  const result = compile(src, {
    runtimeSpecifier: "ignored",
    bundle: true,
    readRuntimeBundle: nodeRuntimeBundleReader,
  });
  if (result.kind !== "ok") {
    const summary = result.errors.map((e) => `${e.code} ${e.message}`).join("\n");
    throw new Error(`compile failed:\n${summary}`);
  }

  // Patch the bottom of the bundle so it stops at `globalThis.__strandApp = App`
  // instead of mounting to a hard-coded "#root" we don't own in tests.
  const patched = result.js
    .replace(`mount(App, document.getElementById("root"));`, "")
    .replace(
      /globalThis\.__strandApp = App;/,
      `globalThis.__strandApp = App; globalThis.__strandRootId = ${JSON.stringify(rootId)};`,
    );

  const dir = mkdtempSync(join(TMP_ROOT, "e2e-"));
  const file = join(dir, "app.mjs");
  writeFileSync(file, patched);

  const url = `${pathToFileURL(file).href}?t=${Date.now()}_${Math.random()}`;
  await import(/* @vite-ignore */ url);

  const app = (globalThis as unknown as { __strandApp?: AppShape }).__strandApp;
  if (!app) throw new Error("Generated bundle did not expose __strandApp");
  return app;
}
