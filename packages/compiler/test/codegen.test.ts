import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compile } from "@kumikijs/compiler";
import { describe, expect, it } from "vitest";

const COUNTER_PATH = resolve(__dirname, "../../../examples/apps/01-counter/app.kumiki");

describe("codegen", () => {
  it("compiles counter to a runnable JS module", () => {
    const src = readFileSync(COUNTER_PATH, "utf8");
    const result = compile(src, { runtimeSpecifier: "./runtime.js" });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.js).toMatch(/import \{ mount[^}]*\} from "\.\/runtime\.js"/);
    expect(result.js).toContain('"count":');
    expect(result.js).toContain("_reducers");
    expect(result.js).toContain("__kumikiApp._dispatch");
  });

  it("compiles a program that uses .concat (issue #5 regression)", () => {
    const src = `
      slot xs : List(Int) = [1, 2, 3]
      slot ys : List(Int) = [4, 5]
      reducer r on=ui.click(B) do= xs := xs.concat(ys)
      tile B = button(text="b")
      tile App = column(B)
      app A caps=[] routes={"/" -> App, "/404" -> App} init=[]
    `;
    const result = compile(src, { runtimeSpecifier: "./runtime.js" });
    // Before the fix this failed typecheck with E0801 (.concat unimplemented).
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    // concat lowers to an array spread of both lists.
    expect(result.js).toContain("[...(");
  });

  it("compiles a named timer + stop-timer", () => {
    const src = `
      slot x : Int = 0
      reducer tick on=timer(1s, name=t) do= x := x + 1
      reducer stop on=ui.click(B) do= stop-timer(t)
      tile B = button(text="stop", onClick=stop)
      tile App = column(B, text(x.show))
      app A caps=[] routes={"/" -> App, "/404" -> App} init=[]
    `;
    const result = compile(src, { runtimeSpecifier: "./runtime.js" });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.js).toContain('name: "t"');
    expect(result.js).toContain('_stops.push("t")');
    expect(result.js).toContain("stopTimers: _stops");
  });

  it("compiles overlay to a z-axis stacking node", () => {
    const src = `
      slot open : Bool = false
      reducer show on=ui.click(B) do= open := true
      tile B = button(text="open", onClick=show)
      tile M = card(text("modal"))
      tile App = overlay(B, when(open, M())) {align: "top"}
      app A caps=[] routes={"/" -> App, "/404" -> App} init=[]
    `;
    const result = compile(src, { runtimeSpecifier: "./runtime.js" });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.js).toContain('kind: "overlay"');
    expect(result.js).toContain('"top"');
  });

  it("keeps a bare tile-ref base child in overlay (parser builtin registration)", () => {
    // Regression: `overlay` must be in the parser's BUILTIN_TILES too, so its
    // children are parsed in tile context. Before the fix, the bare ref
    // `Content` parsed as a value expression and was dropped by
    // collectChildren, leaving the base layer empty.
    const src = `
      slot open : Bool = false
      reducer show on=ui.click(OpenBtn) do= open := true
      tile OpenBtn = button(text="Open", onClick=show)
      tile Content = column(heading("BASE-LAYER"))
      tile Modal = card(text("modal"))
      tile App = overlay(Content, when(open, Modal()))
      app A caps=[] routes={"/" -> App, "/404" -> App} init=[]
    `;
    const result = compile(src, { runtimeSpecifier: "./runtime.js" });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    const overlayPart = result.js.split('kind: "overlay"')[1] ?? "";
    expect(overlayPart).toContain("BASE-LAYER");
  });

  it("lowers panic(msg) to the runtime helper, not an undefined fn call (#24)", () => {
    const src = `
      slot draft : Text = ""
      reducer save on=ui.click(B) do= draft := if draft.is-empty then panic("draft cannot be empty") else draft
      tile B = button(text="save", onClick=save)
      tile App = column(B)
      app A caps=[] routes={"/" -> App, "/404" -> App} init=[]
    `;
    const result = compile(src, { runtimeSpecifier: "./runtime.js" });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    // Before M1, panic() fell through to a user-fn call (`panic(...)`) — an
    // undefined reference at runtime. It must lower to the runtime helper, and
    // EVERY `panic(` in the output must be the `_s.panic(` form (no bare call).
    expect(result.js).toContain('_s.panic("draft cannot be empty")');
    const total = (result.js.match(/panic\(/g) ?? []).length;
    const helper = (result.js.match(/_s\.panic\(/g) ?? []).length;
    expect(helper).toBeGreaterThan(0);
    expect(total).toBe(helper);
  });
});
