import { check, compile, lex, parse } from "@kumikijs/compiler";
import { describe, expect, it } from "vitest";

// Issue #7: spec/stdlib.md §2.2 argument-less methods. Both call shapes must
// work — `recv.m` (FieldAccess, the spec-recommended shortcut) and `recv.m()`
// (MethodCall). The receiver type is irrelevant to these assertions (the checker
// doesn't type-check method receivers), so a single Int slot is a fine stand-in.
const ARGLESS = [
  "head",
  "tail",
  "last",
  "to-list",
  "get-err",
  "to-option",
  "parse-int",
  "parse-float",
  "abs",
  "neg",
  "to-float",
  "to-int",
];

function appSrc(body: string): string {
  return `slot v : Int = 0
tile App = column(${body})
app A
    caps   = []
    routes = {"/" -> App, "/404" -> App}
    init   = []`;
}

const compileOk = (src: string): string => {
  const r = compile(src, { runtimeSpecifier: "./runtime.js" });
  if (r.kind !== "ok") throw new Error(`compile failed: ${JSON.stringify(r)}`);
  return r.js;
};

describe("argument-less stdlib methods (issue #7)", () => {
  it("the parenthesized form no longer trips E0801", () => {
    const body = ARGLESS.map((m) => `heading((v.${m}()).show)`).join(", ");
    const errs = check(parse(lex(appSrc(body))));
    expect(errs.filter((e) => e.code === "E0801")).toEqual([]);
  });

  it("the no-paren form lowers to the runtime helper, not a silent `undefined`", () => {
    const body = ARGLESS.map((m) => `heading((v.${m}).show)`).join(", ");
    const js = compileOk(appSrc(body));
    expect(js).toContain("_s.listHead(");
    expect(js).toContain("_s.listTail(");
    expect(js).toContain("_s.listLast(");
    expect(js).toContain("_s.toList(");
    expect(js).toContain("_s.getErr(");
    expect(js).toContain("_s.toOption(");
    expect(js).toContain("_s.parseIntOpt(");
    expect(js).toContain("_s.parseFloatOpt(");
    expect(js).toContain("Math.abs(");
    expect(js).toContain("Math.trunc(");
    // None of the 12 may fall through to the record-field accessor `(base)["m"]`
    // (the old silent-`undefined` bug). Guards against a future forgotten case.
    for (const m of ARGLESS) expect(js, m).not.toContain(`["${m}"]`);
  });

  it("the parenthesized form lowers identically", () => {
    const body = ARGLESS.map((m) => `heading((v.${m}()).show)`).join(", ");
    const js = compileOk(appSrc(body));
    expect(js).toContain("_s.listHead(");
    expect(js).toContain("_s.toOption(");
    expect(js).toContain("Math.trunc(");
  });
});
