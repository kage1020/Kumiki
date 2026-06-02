// `kumiki smoke` — runtime verification. Compiles a .kumiki file, mounts it in a
// headless DOM (jsdom), exercises its UI, and reports failures that check/build
// cannot catch: runtime throws, empty renders, and unhandled rejections.

import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { compile } from "@kumikijs/compiler";
import { nodeRuntimeBundleReader } from "@kumikijs/compiler/node";
import {
  type AppShape,
  runScenario,
  type Scenario,
  type ScenarioReport,
  type SmokeReport,
  smoke,
} from "@kumikijs/runtime";
import { JSDOM } from "jsdom";

let domReady = false;
function ensureDom(): void {
  if (domReady) return;
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const g = globalThis as unknown as Record<string, unknown>;
  const w = dom.window as unknown as Record<string, unknown>;
  // Overwrite (not skip-if-defined): Node 22 ships globals like `Event` /
  // `CustomEvent` / `navigator` from its own realm. jsdom's elements only accept
  // events constructed from jsdom's realm, so these MUST come from the window or
  // dispatchEvent rejects them ("parameter 1 is not of type 'Event'").
  for (const key of [
    "window",
    "document",
    "navigator",
    "location",
    "history",
    "localStorage",
    "sessionStorage",
    "HTMLElement",
    "HTMLInputElement",
    "HTMLSelectElement",
    "HTMLTextAreaElement",
    "Element",
    "Node",
    "Event",
    "MouseEvent",
    "CustomEvent",
    "KeyboardEvent",
    "CSS",
    "getComputedStyle",
  ]) {
    if (w[key] === undefined) continue;
    try {
      g[key] = w[key];
    } catch {
      // Some Node globals (e.g. `navigator`) are getter-only; redefine them.
      Object.defineProperty(g, key, { value: w[key], configurable: true, writable: true });
    }
  }
  domReady = true;
}

async function loadApp(source: string, capabilities: string[] = []): Promise<AppShape> {
  const result = compile(source, {
    runtimeSpecifier: "ignored",
    bundle: true,
    readRuntimeBundle: nodeRuntimeBundleReader,
    capabilities,
  });
  if (result.kind !== "ok") {
    throw new Error(
      `compile failed:\n${result.errors.map((e) => `${e.code} ${e.message}`).join("\n")}`,
    );
  }
  const patched = result.js.replace(/mount\(App, document\.getElementById\("root"\)\);?/, "");
  const dir = mkdtempSync(join(tmpdir(), "kumiki-smoke-"));
  const file = join(dir, "app.mjs");
  writeFileSync(file, patched);
  await import(pathToFileURL(file).href);
  const app = (globalThis as unknown as { __kumikiApp?: AppShape }).__kumikiApp;
  if (!app) throw new Error("compiled module did not expose __kumikiApp");
  return app;
}

/** Compile + mount + exercise a Kumiki source string; return the smoke report. */
export async function smokeSource(
  source: string,
  capabilities: string[] = [],
): Promise<SmokeReport> {
  ensureDom();
  const app = await loadApp(source, capabilities);
  const doc = (globalThis as unknown as { document: Document }).document;
  const root = doc.createElement("div");
  doc.body.appendChild(root);
  try {
    return await smoke(app, root, { settleMs: 20 });
  } finally {
    root.remove();
  }
}

export async function smokeFile(path: string, capabilities: string[] = []): Promise<SmokeReport> {
  return smokeSource(readFileSync(path, "utf8"), capabilities);
}

/** CLI entry: print a human-readable report and exit non-zero on failure. */
export async function smokeCmd(path: string, capabilities: string[] = []): Promise<void> {
  const report = await smokeFile(path, capabilities);
  if (report.ok) {
    console.log(`ok — mounted, rendered, ${report.interactions} interaction(s), no runtime errors`);
    return;
  }
  console.error(
    `runtime smoke failed (mounted=${report.mounted}, rendered=${report.rendered}, interactions=${report.interactions}):`,
  );
  for (const i of report.issues) {
    console.error(`  [${i.phase}] ${i.message}${i.trigger ? ` (on ${i.trigger})` : ""}`);
  }
  process.exit(1);
}

/** Compile + mount + drive a scenario; return the structured trace. */
export async function runScenarioSource(
  source: string,
  scenario: Scenario,
  capabilities: string[] = [],
): Promise<ScenarioReport> {
  ensureDom();
  const app = await loadApp(source, capabilities);
  const doc = (globalThis as unknown as { document: Document }).document;
  const root = doc.createElement("div");
  doc.body.appendChild(root);
  try {
    return await runScenario(app, root, scenario, { settleMs: 20 });
  } finally {
    root.remove();
  }
}

/** CLI entry: run a scenario JSON file against a .kumiki file; print the trace. */
export async function runCmd(
  kumikiPath: string,
  scenarioPath: string,
  capabilities: string[] = [],
): Promise<void> {
  const scenario = JSON.parse(readFileSync(scenarioPath, "utf8")) as Scenario;
  const report = await runScenarioSource(readFileSync(kumikiPath, "utf8"), scenario, capabilities);
  for (let i = 0; i < report.steps.length; i++) {
    const s = report.steps[i];
    if (!s) continue;
    const head = `step ${i}${s.label ? ` (${s.label})` : ""}${s.action ? `: ${s.action}` : ""}`;
    const status = s.errors.length === 0 && s.failures.length === 0 ? "ok" : "FAIL";
    console.log(`[${status}] ${head}`);
    for (const e of s.errors) console.log(`    error: ${e}`);
    for (const f of s.failures) console.log(`    assert: ${f}`);
  }
  console.log(report.ok ? "\nscenario passed" : "\nscenario FAILED");
  if (!report.ok) process.exit(1);
}
