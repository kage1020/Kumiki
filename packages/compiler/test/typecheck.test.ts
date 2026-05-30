import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { check, lex, parse } from "@strand/compiler";
import { describe, expect, it } from "vitest";

const COUNTER_PATH = resolve(__dirname, "../../../examples/apps/01-counter/app.strand");

const checkSrc = (src: string) => check(parse(lex(src)));

describe("typecheck", () => {
  it("accepts the counter example", () => {
    const src = readFileSync(COUNTER_PATH, "utf8");
    const errors = check(parse(lex(src)));
    expect(errors).toEqual([]);
  });

  it("reports an unimplemented method (E0801)", () => {
    const src = `
      slot raw : Text = ""
      slot n : Result(Int, Text) = Ok(0)
      reducer e on=ui.input(In) do= n := Int.parse(raw).to-result("nope")
      tile In = input(bind=raw)
      tile App = column(In)
      app A caps=[] routes={"/" -> App, "/404" -> App} init=[]
    `;
    const errors = checkSrc(src);
    expect(errors.some((e) => e.code === "E0801" && e.message.includes("to-result"))).toBe(true);
  });

  it("does not flag implemented methods", () => {
    const src = `
      slot xs : List(Int) = [1, 2, 3]
      fn s(ys: List(Int)) -> Int = ys.fold(0, $1 + $2)
      reducer r on=ui.click(B) do= xs := xs.filter($1 > 1)
      tile B = button(text="b")
      tile App = column(B, text(s(xs).show))
      app A caps=[] routes={"/" -> App, "/404" -> App} init=[]
    `;
    expect(checkSrc(src).some((e) => e.code === "E0801")).toBe(false);
  });

  it("reports undefined slot reference (E0103)", () => {
    const src = `
      slot count : Int = 0
      reducer r on=ui.click(B) do= count := usres
      tile B = button(text="b")
      app A caps=[] routes={"/" -> B, "/404" -> B} init=[]
    `;
    const errors = checkSrc(src);
    expect(errors.some((e) => e.code === "E0103" && e.message.includes("usres"))).toBe(true);
  });

  it("reports undefined tile in body (E0105)", () => {
    const src = `
      tile A = column(MissingThing)
      app App caps=[] routes={"/" -> A, "/404" -> A} init=[]
    `;
    const errors = checkSrc(src);
    expect(errors.some((e) => e.code === "E0105" && e.message.includes("MissingThing"))).toBe(true);
  });

  it("reports undefined route target (E0105)", () => {
    const src = `
      tile A = column()
      app App caps=[] routes={"/" -> A, "/x" -> Ghost, "/404" -> A} init=[]
    `;
    const errors = checkSrc(src);
    expect(errors.some((e) => e.code === "E0105" && e.message.includes("Ghost"))).toBe(true);
  });

  it("reports duplicate slot writes in one reducer (E0601)", () => {
    const src = `
      slot count : Int = 0
      tile B = button(text="b")
      reducer r on=ui.click(B) do= count := count + 1; count := 0
      app App caps=[] routes={"/" -> B, "/404" -> B} init=[]
    `;
    const errors = checkSrc(src);
    expect(errors.some((e) => e.code === "E0601")).toBe(true);
  });

  it("reports undefined reducer in event handler (E0102)", () => {
    const src = `
      tile B = button(text="b") {onClick: nope}
      app App caps=[] routes={"/" -> B, "/404" -> B} init=[]
    `;
    const errors = checkSrc(src);
    expect(errors.some((e) => e.code === "E0102" && e.message.includes("nope"))).toBe(true);
  });

  it("requires /404 route entry", () => {
    const src = `
      tile A = column()
      app App caps=[] routes={"/" -> A} init=[]
    `;
    const errors = checkSrc(src);
    expect(errors.some((e) => e.code === "E0001")).toBe(true);
  });

  it("allows the same slot to be written in both if/else branches", () => {
    const src = `
      slot x : Int = 0
      slot y : Bool = true
      reducer r on=ui.click(B) do=
        if y
          then x := 1
          else x := 2
      tile B = button(text="b")
      app App caps=[] routes={"/" -> B, "/404" -> B} init=[]
    `;
    const errors = checkSrc(src);
    expect(errors.some((e) => e.code === "E0601")).toBe(false);
  });

  it("still flags duplicate writes on the same sequential path", () => {
    const src = `
      slot x : Int = 0
      reducer r on=ui.click(B) do=
        x := 1
        x := 2
      tile B = button(text="b")
      app App caps=[] routes={"/" -> B, "/404" -> B} init=[]
    `;
    const errors = checkSrc(src);
    expect(errors.some((e) => e.code === "E0601")).toBe(true);
  });

  it("flags writing the same slot after an if/else that already wrote it", () => {
    const src = `
      slot x : Int = 0
      slot y : Bool = true
      reducer r on=ui.click(B) do=
        if y then x := 1 else x := 2
        x := 3
      tile B = button(text="b")
      app App caps=[] routes={"/" -> B, "/404" -> B} init=[]
    `;
    const errors = checkSrc(src);
    expect(errors.some((e) => e.code === "E0601")).toBe(true);
  });
});
