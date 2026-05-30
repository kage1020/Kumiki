// Strand MCP server — exposes the compiler and AI-edit toolchain as MCP tools.
//
// Tools fall into three groups:
//   * source / file validation  (check, build)
//   * project navigation + edits (list, view, refs, add, replace, remove, rename, fix)
//   * spec access                (spec_search, spec_list, spec_get)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  addDef,
  findReferences,
  listDefs,
  load,
  planFixes,
  removeDef,
  renameDef,
  replaceDef,
  runScenarioSource,
  smokeSource,
  viewDef,
  viewWithDeps,
} from "@strand/cli";

type Scenario = Parameters<typeof runScenarioSource>[1];

import type { StrandError } from "@strand/compiler";
import { check, compile, lex, parse } from "@strand/compiler";
import { nodeRuntimeBundleReader } from "@strand/compiler/node";
import { z } from "zod";
import { getSpecDoc, listSpecDocs, searchSpec } from "./spec.ts";

type Diagnostic = { code: string; kind: string; message: string; line: number; col: number };

function text(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}

function readSource(input: { source?: string | undefined; path?: string | undefined }): string {
  if (typeof input.source === "string") return input.source;
  if (input.path) return readFileSync(resolve(process.cwd(), input.path), "utf8");
  throw new Error("provide either `source` or `path`");
}

function toDiagnostics(errors: StrandError[]): Diagnostic[] {
  return errors.map((e) => ({
    code: e.code,
    kind: e.kind,
    message: e.message,
    line: e.pos.line,
    col: e.pos.col,
  }));
}

/** Parse + typecheck, normalizing parse exceptions into a single diagnostic. */
function validate(source: string): { ok: boolean; diagnostics: Diagnostic[] } {
  try {
    const program = parse(lex(source));
    const errors = check(program);
    return { ok: errors.length === 0, diagnostics: toDiagnostics(errors) };
  } catch (e) {
    const pe = e as { message?: string; pos?: { line: number; col: number } };
    return {
      ok: false,
      diagnostics: [
        {
          code: "E0000",
          kind: "parse-error",
          message: pe.message ?? String(e),
          line: pe.pos?.line ?? 0,
          col: pe.pos?.col ?? 0,
        },
      ],
    };
  }
}

export function createServer(): McpServer {
  const server = new McpServer({ name: "strand", version: "0.1.0" });

  server.registerTool(
    "strand_check",
    {
      title: "Check Strand source",
      description:
        "Parse and typecheck a Strand program. Pass `source` (text) or `path` (file). Returns ok or a list of diagnostics with codes (see spec/errors.md).",
      inputSchema: {
        source: z.string().optional().describe("Full Strand source text"),
        path: z.string().optional().describe("Path to a .strand file (relative to cwd)"),
      },
    },
    async (input) => {
      const result = validate(readSource(input));
      if (result.ok) return text("ok — no diagnostics");
      return text(JSON.stringify(result.diagnostics, null, 2));
    },
  );

  server.registerTool(
    "strand_build",
    {
      title: "Build Strand source",
      description:
        "Compile a Strand program to a self-contained JS module (runtime inlined). Pass `source` or `path`. Returns the generated JS, or diagnostics on failure.",
      inputSchema: {
        source: z.string().optional(),
        path: z.string().optional(),
        includeJs: z.boolean().optional().describe("Return full JS (default: only a summary)"),
      },
    },
    async (input) => {
      const source = readSource(input);
      const result = compile(source, {
        runtimeSpecifier: "./runtime.js",
        bundle: true,
        readRuntimeBundle: nodeRuntimeBundleReader,
      });
      if (result.kind === "fail") {
        return text(`build failed:\n${JSON.stringify(toDiagnostics(result.errors), null, 2)}`);
      }
      if (input.includeJs) return text(result.js);
      return text(
        `build ok — ${result.js.length} bytes of JS (pass includeJs=true for the source)`,
      );
    },
  );

  server.registerTool(
    "strand_smoke",
    {
      title: "Runtime smoke test",
      description:
        "Mount a Strand program in a headless DOM, exercise its UI, and report runtime failures that check/build cannot catch (throws, empty render, unhandled rejections). Pass `source` or `path`. Run this after check/build — a program can compile yet error or render nothing when actually used.",
      inputSchema: {
        source: z.string().optional(),
        path: z.string().optional(),
      },
    },
    async (input) => {
      const source = readSource(input);
      const report = await smokeSource(source);
      if (report.ok) {
        return text(
          `ok — mounted, rendered, ${report.interactions} interaction(s), no runtime errors`,
        );
      }
      const lines = report.issues.map(
        (i) => `[${i.phase}] ${i.message}${i.trigger ? ` (on ${i.trigger})` : ""}`,
      );
      return text(
        `runtime smoke failed (mounted=${report.mounted}, rendered=${report.rendered}):\n${lines.join("\n")}`,
      );
    },
  );

  server.registerTool(
    "strand_run_scenario",
    {
      title: "Run a scenario",
      description:
        "Drive a Strand app through a scenario and return a per-step trace (slot state, DOM text, errors, emitted effects) plus assertion results. This is the substrate for an autonomous generate→run→observe→fix loop: write the user's requirements as scenario steps with `expect` assertions on state, run, read the trace, and patch without a human operating the app.\n\nScenario shape: { steps: [{ label?, do?, expect? }], effects?: { <name>: [{outcome, value}] } }. An action `do` is one of: {dispatch, payload?}, {clickText}, {click}, {fill, value}, {choose, value}, {navigate}. An `expect` is { noErrors?, state?: {slot: value}, domIncludes?: [..], domExcludes?: [..] } (state uses partial match; keys may be dotted paths).",
      inputSchema: {
        source: z.string().optional(),
        path: z.string().optional(),
        scenario: z
          .object({
            steps: z.array(z.record(z.string(), z.unknown())),
            effects: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))).optional(),
            defaultEffect: z.record(z.string(), z.unknown()).optional(),
          })
          .describe("The scenario to run"),
      },
    },
    async (input) => {
      const source = readSource(input);
      const report = await runScenarioSource(source, input.scenario as unknown as Scenario);
      const lines = report.steps.map((s, i) => {
        const status = s.errors.length === 0 && s.failures.length === 0 ? "ok" : "FAIL";
        const head = `step ${i}${s.label ? ` (${s.label})` : ""}${s.action ? `: ${s.action}` : ""}`;
        const sub = [
          ...s.errors.map((e) => `    error: ${e}`),
          ...s.failures.map((f) => `    assert: ${f}`),
        ];
        const emits = s.emits.length ? `    emits: ${s.emits.map((e) => e.effect).join(", ")}` : "";
        return [`[${status}] ${head}`, ...sub, emits].filter(Boolean).join("\n");
      });
      const tail = report.ok ? "scenario passed" : "scenario FAILED";
      // Include the final state snapshot to help the agent diagnose.
      const finalState = report.steps.at(-1)?.state ?? {};
      return text(`${lines.join("\n")}\n\n${tail}\nfinal state: ${JSON.stringify(finalState)}`);
    },
  );

  server.registerTool(
    "strand_list",
    {
      title: "List definitions",
      description: "List the definitions in a .strand file, optionally filtered by layer.",
      inputSchema: {
        path: z.string().describe("Path to a .strand file"),
        layer: z
          .enum(["type", "slot", "effect", "reducer", "tile", "fn", "app", "theme"])
          .optional(),
      },
    },
    async ({ path, layer }) => {
      const store = load(resolve(process.cwd(), path));
      const entries = listDefs(store, layer).map(
        (e) => `${e.layer}.${e.name}  (lines ${e.range.startLine}-${e.range.endLine})`,
      );
      return text(entries.join("\n") || "(no definitions)");
    },
  );

  server.registerTool(
    "strand_view",
    {
      title: "View a definition",
      description:
        "Show the source of one definition (`<layer>.<name>`), optionally with its dependencies.",
      inputSchema: {
        path: z.string(),
        name: z.string().describe("Qualified name, e.g. tile.App or reducer.addTodo"),
        withDeps: z.boolean().optional(),
      },
    },
    async ({ path, name, withDeps }) => {
      const store = load(resolve(process.cwd(), path));
      const out = withDeps ? viewWithDeps(store, name) : viewDef(store, name);
      return text(out ?? `not found: ${name}`);
    },
  );

  server.registerTool(
    "strand_refs",
    {
      title: "Find references",
      description: "Find all sites that reference a definition.",
      inputSchema: { path: z.string(), name: z.string() },
    },
    async ({ path, name }) => {
      const store = load(resolve(process.cwd(), path));
      const refs = findReferences(store, name).map((r) => `${r.qname} @ line ${r.line}`);
      return text(refs.join("\n") || "(no references)");
    },
  );

  server.registerTool(
    "strand_add",
    {
      title: "Add a definition",
      description: "Append a new definition to a .strand file.",
      inputSchema: {
        path: z.string(),
        layer: z.enum(["type", "slot", "effect", "reducer", "tile", "fn", "app", "theme"]),
        name: z.string(),
        body: z.string().describe("The definition body (without the `<layer> <name>` prefix)"),
      },
    },
    async ({ path, layer, name, body }) => {
      addDef(resolve(process.cwd(), path), layer, name, body);
      return text(`added ${layer}.${name}`);
    },
  );

  server.registerTool(
    "strand_replace",
    {
      title: "Replace a definition",
      description: "Replace the body of an existing definition.",
      inputSchema: { path: z.string(), name: z.string(), body: z.string() },
    },
    async ({ path, name, body }) => {
      replaceDef(resolve(process.cwd(), path), name, body);
      return text(`replaced ${name}`);
    },
  );

  server.registerTool(
    "strand_remove",
    {
      title: "Remove a definition",
      description:
        "Remove a definition. Set cascade=true to also remove definitions that only it referenced.",
      inputSchema: { path: z.string(), name: z.string(), cascade: z.boolean().optional() },
    },
    async ({ path, name, cascade }) => {
      removeDef(resolve(process.cwd(), path), name, cascade ?? false);
      return text(`removed ${name}`);
    },
  );

  server.registerTool(
    "strand_rename",
    {
      title: "Rename a definition",
      description: "Rename a definition and update all references.",
      inputSchema: { path: z.string(), name: z.string(), newName: z.string() },
    },
    async ({ path, name, newName }) => {
      renameDef(resolve(process.cwd(), path), name, newName);
      return text(`renamed ${name} -> ${newName}`);
    },
  );

  server.registerTool(
    "strand_fix",
    {
      title: "Plan auto-fixes",
      description:
        "Typecheck a file and propose auto-patches for repairable errors (e.g. misspelled names). Returns the planned fixes; this tool does not write to disk.",
      inputSchema: { path: z.string() },
    },
    async ({ path }) => {
      const abs = resolve(process.cwd(), path);
      const store = load(abs);
      const errors = check(store.program);
      const patches = planFixes(store, errors).map((p) => `${p.code}: ${p.description}`);
      return text(patches.join("\n") || "(no auto-fixable diagnostics)");
    },
  );

  server.registerTool(
    "strand_spec_search",
    {
      title: "Search the spec",
      description: "Keyword search across the normative spec/ documents. Returns doc:line matches.",
      inputSchema: { query: z.string() },
    },
    async ({ query }) => {
      const hits = searchSpec(query).map((h) => `${h.doc}:${h.line}  ${h.text}`);
      return text(hits.join("\n") || `(no matches for "${query}")`);
    },
  );

  server.registerTool(
    "strand_spec_list",
    {
      title: "List spec documents",
      description: "List the available normative spec/ documents.",
      inputSchema: {},
    },
    async () => text(listSpecDocs().join("\n") || "(spec/ not found)"),
  );

  server.registerTool(
    "strand_spec_get",
    {
      title: "Get a spec document",
      description: "Fetch the full text of one spec document (e.g. 'language' or 'errors.md').",
      inputSchema: { doc: z.string() },
    },
    async ({ doc }) => text(getSpecDoc(doc) ?? `not found: ${doc}`),
  );

  return server;
}
