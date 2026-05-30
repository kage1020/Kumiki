import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  addDef,
  findReferences,
  fixCmd,
  listDefs,
  load,
  planFixes,
  removeDef,
  renameDef,
  replaceDef,
  viewDef,
} from "@strand/cli";
import { check } from "@strand/compiler";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const _COUNTER = resolve(here, "../../../examples/apps/01-counter/app.strand");
const TODOMVC = resolve(here, "../../../examples/apps/02-todomvc/app.strand");

function copy(src: string): string {
  const dir = mkdtempSync(join(tmpdir(), "strand-ai-"));
  const dst = join(dir, "input.strand");
  copyFileSync(src, dst);
  return dst;
}

describe("strand store: list / view / refs", () => {
  it("lists every definition from todomvc", () => {
    const store = load(TODOMVC);
    const layers = new Set(listDefs(store).map((e) => e.layer));
    expect(layers).toContain("type");
    expect(layers).toContain("slot");
    expect(layers).toContain("effect");
    expect(layers).toContain("reducer");
    expect(layers).toContain("fn");
    expect(layers).toContain("tile");
    expect(layers).toContain("app");
    expect(layers).toContain("theme");
  });

  it("views a specific slot", () => {
    const store = load(TODOMVC);
    const text = viewDef(store, "slot.todos");
    expect(text).toContain("slot todos");
    expect(text).toContain("Map(TodoId, Todo)");
  });

  it("finds references to slot.todos", () => {
    const store = load(TODOMVC);
    const refs = findReferences(store, "slot.todos");
    const names = new Set(refs.map((r) => r.qname));
    expect(names.has("reducer.addTodo")).toBe(true);
    expect(names.has("reducer.toggle")).toBe(true);
    expect(names.has("reducer.remove")).toBe(true);
    expect(names.has("reducer.clearDone")).toBe(true);
  });
});

describe("strand mutate: add / replace / rename / remove", () => {
  let path: string;
  beforeEach(() => {
    path = copy(TODOMVC);
  });
  afterEach(() => {
    rmSync(dirname(path), { recursive: true, force: true });
  });

  it("adds a new slot at the end of the file and validates", () => {
    addDef(path, "slot", "lastSync", "Time = 0");
    const store = load(path);
    expect(store.byQName.has("slot.lastSync")).toBe(true);
    expect(viewDef(store, "slot.lastSync")).toContain("slot lastSync : Time = 0");
    // op log entry
    const log = readFileSync(`${path}.strand-ops.jsonl`, "utf8");
    expect(log).toContain('"op":"add"');
    expect(log).toContain('"name":"lastSync"');
  });

  it("rolls back when add introduces a typecheck error", () => {
    const before = readFileSync(path, "utf8");
    expect(() => addDef(path, "tile", "Broken", "column(Nonexistent)")).toThrowError(
      /Validation failed/,
    );
    expect(readFileSync(path, "utf8")).toBe(before);
  });

  it("rename updates the def and every reference", () => {
    renameDef(path, "slot.draft", "newTodoText");
    const store = load(path);
    expect(store.byQName.has("slot.newTodoText")).toBe(true);
    expect(store.byQName.has("slot.draft")).toBe(false);
    const refs = findReferences(store, "slot.newTodoText");
    expect(refs.length).toBeGreaterThan(0);
  });

  it("remove without --cascade fails on referenced slot", () => {
    expect(() => removeDef(path, "slot.todos", false)).toThrowError(/Cannot remove .* references/);
  });

  it("remove --cascade gets rejected when validation fails (densely-coupled file)", () => {
    // TodoMVC is so tightly coupled around `slot.filter` that cascading it
    // pulls in shared infrastructure (matchFilter, FilterTab, FilterBar,
    // Footer, App, …) and the residual file no longer typechecks. The
    // PoC's "validate-then-rollback" behaviour kicks in and reports.
    expect(() => removeDef(path, "slot.filter", true)).toThrowError(/remove rejected/);
    // Original file is restored.
    const store = load(path);
    expect(store.byQName.has("slot.filter")).toBe(true);
  });

  it("replace swaps the body and validates", () => {
    replaceDef(path, "slot.draft", 'Text = ""');
    const store = load(path);
    const body = viewDef(store, "slot.draft");
    expect(body).toContain('Text = ""');
    expect(body).not.toContain("where len-lt");
  });
});

describe("strand fix: auto-patch suggestions", () => {
  it("suggests did-you-mean for an undef slot reference", () => {
    const dir = mkdtempSync(join(tmpdir(), "strand-fix-"));
    const file = join(dir, "broken.strand");
    writeFileSync(
      file,
      `type N = nominal Int where between(0, 999)
slot count : N = 0
reducer inc on=ui.click(IncBtn) do= conut := conut + 1
tile IncBtn = button(text="+")
tile App = column(heading("Count: " + count), IncBtn)
app Counter
    caps = []
    routes = {"/" -> App}
    init = []
`,
    );
    const store = load(file);
    const errors = check(store.program);
    const patches = planFixes(store, errors);
    const descs = patches.map((p) => p.description);
    expect(descs.some((d) => d.includes(`replace "conut" with "count"`))).toBe(true);
    expect(descs.some((d) => d.includes(`"/404" -> NotFound`))).toBe(true);
    rmSync(dir, { recursive: true, force: true });
  });

  it("apply fixes the file end-to-end", () => {
    const dir = mkdtempSync(join(tmpdir(), "strand-fix-"));
    const file = join(dir, "broken.strand");
    writeFileSync(
      file,
      `type N = nominal Int where between(0, 999)
slot count : N = 0
reducer inc on=ui.click(IncBtn) do= conut := conut + 1
tile IncBtn = button(text="+")
tile App = column(heading("Count: " + count), IncBtn)
app Counter
    caps = []
    routes = {"/" -> App}
    init = []
`,
    );
    fixCmd(file, true);
    const store = load(file);
    expect(check(store.program)).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("parallel op merge", () => {
  // Simulate two independent agents editing in parallel. We apply their ops in
  // both orders and check that the file converges to the same logical state
  // (= same defs, no typecheck errors).
  it("converges regardless of op order: add slot + rename existing slot", () => {
    const aFirst = copy(TODOMVC);
    const bFirst = copy(TODOMVC);
    // a: add new slot. b: rename slot.draft → newDraft.
    addDef(aFirst, "slot", "lastSync", "Time = 0");
    renameDef(aFirst, "slot.draft", "newDraft");

    renameDef(bFirst, "slot.draft", "newDraft");
    addDef(bFirst, "slot", "lastSync", "Time = 0");

    const aStore = load(aFirst);
    const bStore = load(bFirst);
    const aNames = new Set(listDefs(aStore).map((e) => `${e.layer}.${e.name}`));
    const bNames = new Set(listDefs(bStore).map((e) => `${e.layer}.${e.name}`));
    expect(aNames).toEqual(bNames);
    expect(aNames.has("slot.newDraft")).toBe(true);
    expect(aNames.has("slot.lastSync")).toBe(true);
    expect(check(aStore.program)).toEqual([]);
    expect(check(bStore.program)).toEqual([]);
    rmSync(dirname(aFirst), { recursive: true, force: true });
    rmSync(dirname(bFirst), { recursive: true, force: true });
  });
});
