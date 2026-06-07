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

  // ----- v0.6 M1: `expect` wildcards (spec/testing.md §8.2.2) -----

  it("parses and accepts `<any-id>` / `<slots.X>` wildcards in a reducer-test expect", () => {
    const src = `
type TodoId = nominal Text where uuid
type Todo = {id: TodoId, text: Text, done: Bool}
slot todos : Map(TodoId, Todo) = {}
slot draft : Text = ""
effect persist cap=storage.write in=Map(TodoId, Todo) out=Result(Unit, Text)
reducer add on=ui.submit(F) do=
  let id = TodoId.fresh()
  todos[id] := {id, text=draft, done=false}
tile F = form(input(bind=draft))
tile App = column(F)
app A caps=[storage.write] routes={"/" -> App, "/404" -> App} init=[]
test add-basic = reducer-test add
  given = {slots:{todos:{}, draft:"Hi"}, event:{type: ui.submit, target: F}}
  expect = {slots:{todos:{<any-id>: {id: <any-id>, text:"Hi", done:false}}, draft:""}, effects:[persist(<slots.todos>)]}`;
    const program = parse(lex(src));
    const tests = program.defs.filter((d): d is TestDef => d.kind === "TestDef");
    expect(tests.length).toBe(1);
    expect(checkSrc(src)).toEqual([]);
  });

  it("rejects a wildcard used outside a test expect (E0109)", () => {
    const src = `
slot count : Int = 0
reducer bad on=ui.click(B) do= count := <any-id>
tile B = button(text="x", onClick=bad)
tile App = column(B)
app A caps=[] routes={"/" -> App, "/404" -> App} init=[]`;
    expect(checkSrc(src).some((e) => e.code === "E0109")).toBe(true);
  });

  it("rejects a wildcard in a reducer-test `given` (E0109 — expect only)", () => {
    const src = `
slot count : Int = 0
reducer inc on=ui.click(B) do= count := count + 1
tile B = button(text="+1", onClick=inc)
tile App = column(B)
app A caps=[] routes={"/" -> App, "/404" -> App} init=[]
test t = reducer-test inc given={slots:{count:<any-id>}, event:{type: ui.click, target: B}} expect={slots:{count:1}, effects:[]}`;
    expect(checkSrc(src).some((e) => e.code === "E0109")).toBe(true);
  });

  it("rejects a wildcard nested under another expression in `given` (E0109)", () => {
    // A wildcard buried under a FieldAccess must not escape the given-scan.
    const src = `
slot count : Int = 0
reducer inc on=ui.click(B) do= count := count + 1
tile B = button(text="+1", onClick=inc)
tile App = column(B)
app A caps=[] routes={"/" -> App, "/404" -> App} init=[]
test t = reducer-test inc given={slots:{count:<slots.count>.foo}, event:{type: ui.click, target: B}} expect={slots:{count:1}, effects:[]}`;
    expect(checkSrc(src).some((e) => e.code === "E0109")).toBe(true);
  });

  it("rejects `<slots.X>` naming an undefined slot in expect (E0103)", () => {
    const src = `
slot count : Int = 0
reducer inc on=ui.click(B) do= count := count + 1
tile B = button(text="+1", onClick=inc)
tile App = column(B)
app A caps=[] routes={"/" -> App, "/404" -> App} init=[]
test t = reducer-test inc given={slots:{count:0}, event:{type: ui.click, target: B}} expect={slots:{count:1}, effects:[persist(<slots.itms>)]}`;
    expect(checkSrc(src).some((e) => e.code === "E0103" && e.message.includes("itms"))).toBe(true);
  });
});
