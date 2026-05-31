import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AppDef, ReducerDef, SlotDef, TileDef, TypeDef } from "@kumiki/compiler";
import { lex, parse } from "@kumiki/compiler";
import { describe, expect, it } from "vitest";

const COUNTER_PATH = resolve(__dirname, "../../../examples/apps/01-counter/app.kumiki");

describe("parser", () => {
  it("parses the counter example end-to-end", () => {
    const source = readFileSync(COUNTER_PATH, "utf8");
    const program = parse(lex(source));

    const byKind = <K extends string>(kind: K) => program.defs.filter((d) => d.kind === kind);

    expect(byKind("TypeDef")).toHaveLength(1);
    expect(byKind("SlotDef")).toHaveLength(1);
    expect(byKind("ReducerDef")).toHaveLength(3);
    expect(byKind("TileDef")).toHaveLength(4);
    expect(byKind("AppDef")).toHaveLength(1);

    const slot = byKind("SlotDef")[0] as SlotDef;
    expect(slot.name).toBe("count");
    expect(slot.init).toMatchObject({ kind: "Num", value: 0 });

    const typeN = byKind("TypeDef")[0] as TypeDef;
    expect(typeN.name).toBe("N");
    expect(typeN.body.kind).toBe("TypeNominal");

    const incReducer = (byKind("ReducerDef") as ReducerDef[]).find((r) => r.name === "inc");
    expect(incReducer).toBeDefined();
    expect(incReducer?.on.kind).toBe("UiEvent");
    expect(incReducer?.on.ev).toBe("click");
    expect(incReducer?.on.selector.tile).toBe("IncBtn");
    expect(incReducer?.do).toHaveLength(1);
    expect(incReducer?.do[0]).toMatchObject({
      kind: "SlotAssign",
      lvalue: { kind: "LSlot", name: "count" },
      rhs: { kind: "BinOp", op: "+" },
    });

    const app = byKind("AppDef")[0] as AppDef;
    expect(app.name).toBe("Counter");
    expect(app.caps).toEqual([]);
    expect(app.routes.map((r) => r.path)).toEqual(["/", "/404"]);
    expect(app.init).toEqual([]);

    const appTile = (byKind("TileDef") as TileDef[]).find((t) => t.name === "App");
    expect(appTile).toBeDefined();
    expect(appTile?.body.name).toBe("column");
  });

  it("parses an effect definition (Phase 2)", () => {
    const program = parse(lex("effect foo cap=http.get in=Unit out=Unit"));
    expect(program.defs).toHaveLength(1);
    expect(program.defs[0]).toMatchObject({ kind: "EffectDef", name: "foo", cap: "http.get" });
  });

  it("parses a small tile with props", () => {
    const src = `tile DecBtn = button(text="-")`;
    const program = parse(lex(src));
    expect(program.defs).toHaveLength(1);
    const tile = program.defs[0] as TileDef;
    expect(tile.name).toBe("DecBtn");
    expect(tile.body.name).toBe("button");
    expect(tile.body.args[0]).toMatchObject({ name: "text" });
  });

  it("parses an expression with binary precedence", () => {
    const program = parse(lex("slot x : Int = 1 + 2 * 3"));
    const slot = program.defs[0] as SlotDef;
    expect(slot.init).toMatchObject({
      kind: "BinOp",
      op: "+",
      rhs: { kind: "BinOp", op: "*" },
    });
  });

  it("parses a selector with id", () => {
    const src = `reducer r on=ui.submit(LoginForm#new) do= x := 1`;
    const program = parse(lex(src));
    const r = program.defs[0] as ReducerDef;
    expect(r.on.selector).toEqual({ tile: "LoginForm", id: "new" });
  });

  it("parses a timer event", () => {
    const src = `slot x : Int = 0
reducer tick on=timer(1s) do= x := x + 1`;
    const program = parse(lex(src));
    const r = program.defs[1] as ReducerDef;
    expect(r.on.kind).toBe("TimerEvent");
    if (r.on.kind !== "TimerEvent") throw new Error("expected TimerEvent");
    expect(r.on.intervalMs).toBe(1000);
  });

  it("accepts `&` as an alias for `&&` in bool expressions", () => {
    const src = `slot a : Bool = true
slot b : Bool = false
reducer r on=ui.click(B) do= a := a & b
tile B = button(text="b")`;
    const program = parse(lex(src));
    const r = program.defs.find((d) => d.kind === "ReducerDef") as ReducerDef;
    const stmt = r.do[0] as { rhs: { kind: string; op: string } };
    expect(stmt.rhs.kind).toBe("BinOp");
    expect(stmt.rhs.op).toBe("&");
  });

  it("parses a timer event with ms unit", () => {
    const src = `slot x : Int = 0
reducer tick on=timer(250ms) do= x := x + 1`;
    const program = parse(lex(src));
    const r = program.defs[1] as ReducerDef;
    if (r.on.kind !== "TimerEvent") throw new Error("expected TimerEvent");
    expect(r.on.intervalMs).toBe(250);
  });
});
