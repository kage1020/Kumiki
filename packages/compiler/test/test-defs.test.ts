import type { TestDef } from "@kumikijs/compiler";
import { check, lex, parse } from "@kumikijs/compiler";
import { describe, expect, it } from "vitest";

const checkSrc = (src: string) => check(parse(lex(src)));

describe("test definitions", () => {
  it("parses a reducer-test and a tile-test", () => {
    const src = `
slot count : Int = 0
reducer inc on=ui.click(B) do= count := count + 1
tile B = button(text="+1", onClick=inc)
tile App = column(B)
app A caps=[] routes={"/" -> App, "/404" -> App} init=[]
test t1 = reducer-test inc given={slots:{count:0}, event:{type: ui.click, target: B}} expect={slots:{count:1}, effects:[]}
test t2 = tile-test App given={slots:{count:0}} expect=column(button(text="+1"))`;
    const program = parse(lex(src));
    const tests = program.defs.filter((d): d is TestDef => d.kind === "TestDef");
    expect(tests.length).toBe(2);
    expect(tests[0]?.testKind).toBe("reducer-test");
    expect(tests[0]?.target).toBe("inc");
    expect(tests[1]?.testKind).toBe("tile-test");
    expect(tests[1]?.target).toBe("App");
  });

  it("reports an unknown reducer in a reducer-test (E0102)", () => {
    const src = `
slot count : Int = 0
reducer inc on=ui.click(B) do= count := count + 1
tile B = button(text="x", onClick=inc)
tile App = column(B)
app A caps=[] routes={"/" -> App, "/404" -> App} init=[]
test t = reducer-test nope given={slots:{count:0}, event:{type: ui.click, target: B}} expect={slots:{count:1}, effects:[]}`;
    expect(checkSrc(src).some((e) => e.code === "E0102" && e.message.includes("nope"))).toBe(true);
  });

  it("reports an unknown tile in a tile-test (E0105)", () => {
    const src = `
tile App = column(text("x"))
app A caps=[] routes={"/" -> App, "/404" -> App} init=[]
test t = tile-test Nope given={slots:{}} expect=column(text("x"))`;
    expect(checkSrc(src).some((e) => e.code === "E0105" && e.message.includes("Nope"))).toBe(true);
  });

  it("accepts well-formed tests with no diagnostics", () => {
    const src = `
slot count : Int = 0
reducer inc on=ui.click(B) do= count := count + 1
tile B = button(text="+1", onClick=inc)
tile App = column(B)
app A caps=[] routes={"/" -> App, "/404" -> App} init=[]
test t = reducer-test inc given={slots:{count:0}, event:{type: ui.click, target: B}} expect={slots:{count:1}, effects:[]}`;
    expect(checkSrc(src)).toEqual([]);
  });
});
