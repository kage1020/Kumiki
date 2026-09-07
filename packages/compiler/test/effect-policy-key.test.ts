// The `latest-per-key` key runs when the effect dispatches, so a name nothing
// checked there was a `ReferenceError` on the first dispatch rather than a
// diagnostic — the app imported, mounted and rendered first.

import { check, compile, lex, parse } from "@kumikijs/compiler";
import { describe, expect, it } from "vitest";

function diagnose(source: string): { code: string; message: string; line: number; col: number }[] {
  return check(parse(lex(source))).map((e) => ({
    code: e.code,
    message: e.message,
    line: e.pos.line,
    col: e.pos.col,
  }));
}

function codes(source: string): string[] {
  return diagnose(source).map((e) => e.code);
}

/** The one diagnostic a source is expected to draw, so a position can be read off it. */
function only(source: string): { code: string; message: string; line: number; col: number } {
  const found = diagnose(source);
  expect(found).toHaveLength(1);
  const first = found[0];
  if (!first) throw new Error("expected one diagnostic");
  return first;
}

/** The text at a diagnostic's own line and column, so a position is read rather than counted. */
function textAt(source: string, at: { line: number; col: number }): string {
  return (source.split("\n")[at.line - 1] ?? "").slice(at.col - 1);
}

/** A program whose only variable is the effect's `policy=` key. */
function app(key: string): string {
  return `slot query : Text = ""
effect load cap=http.get in=Text out=Result(Text, HttpError)
            policy=latest-per-key(${key})
tile B = button(text="b")
tile Home = column(B)
app M caps=[http.get] routes={"/" -> Home, "/404" -> Home} init=[]`;
}

/** The same program with the expression in `map-request`, which shares the key's scope. */
function mapRequestApp(expr: string): string {
  return `slot query : Text = ""
effect persist cap=storage.write in=Text out=Result(Unit, Text)
               map-request={key: ${expr}, value: $1}
tile B = button(text="b")
tile Home = column(B)
app M caps=[storage.write] routes={"/" -> Home, "/404" -> Home} init=[]`;
}

describe("an effect's latest-per-key key is checked", () => {
  it("reports a misspelled name as E0103 at the key", () => {
    const source = app("quary");
    const at = only(source);
    expect(at.code).toBe("E0103");
    expect(at.message).toContain('"quary"');
    expect(textAt(source, at)).toMatch(/^quary/);
  });

  it("reports a built-in call missing its argument as E0213 at the key", () => {
    const source = app("Bytes.from-text()");
    const at = only(source);
    expect(at.code).toBe("E0213");
    expect(at.message).toContain("Bytes.from-text");
    expect(textAt(source, at)).toMatch(/^Bytes\.from-text\(\)/);
  });

  // The measurement that motivated the fix: before the key was walked, a
  // misspelled name built cleanly and lowered to a bare global, so the app
  // imported, mounted and rendered before dying on the first dispatch.
  it("no longer lowers an undefined name into the generated dispatch", () => {
    const result = compile(app("quary"), { runtimeSpecifier: "./runtime.js" });
    expect(result.kind).toBe("fail");
  });

  // The key's own binds, unchanged: `$1` is the effect's input, a slot is
  // readable (codegen lowers one through the live slot map), and a `fn` is
  // callable. None of these may become E0103 on the way to the two above.
  it.each([
    ["the effect input", "$1"],
    ["a slot", "query"],
    ["an expression over both", "$1 + query"],
  ])("accepts %s in the key", (_what, key) => {
    expect(codes(app(key))).toEqual([]);
  });

  it("accepts a fn call in the key", () => {
    const source = `slot query : Text = ""
fn norm(s: Text) -> Text = s
effect load cap=http.get in=Text out=Result(Text, HttpError)
            policy=latest-per-key(norm($1))
tile B = button(text="b")
tile Home = column(B)
app M caps=[http.get] routes={"/" -> Home, "/404" -> Home} init=[]`;
    expect(codes(source)).toEqual([]);
  });

  // `$route` is a payload field, and the key is applied to the effect's input
  // and nothing else — the same `no-payload` answer `map-request` gives, so
  // the name means nothing here rather than being a bind out of its scope.
  it("reports $route in the key as an undefined name", () => {
    expect(codes(app("$route.path"))).toEqual(["E0103"]);
  });

  // Every other policy carries no expression, so nothing new is walked.
  it("leaves a policy that carries no expression alone", () => {
    const source = `effect load cap=http.get in=Text out=Result(Text, HttpError) policy=debounce(300ms)
tile B = button(text="b")
tile Home = column(B)
app M caps=[http.get] routes={"/" -> Home, "/404" -> Home} init=[]`;
    expect(codes(source)).toEqual([]);
  });
});

// `map-request` shares `pureScope` with the key, so a change made for the key's
// sake changes `map-request` too. These pin its half of that scope.
describe("an effect's map-request is checked in the same scope", () => {
  it("reports a misspelled name as E0103", () => {
    const at = only(mapRequestApp("quary"));
    expect(at.code).toBe("E0103");
    expect(at.message).toContain('"quary"');
  });

  it.each([
    ["the effect input", "$1"],
    ["a slot", "query"],
  ])("accepts %s", (_what, expr) => {
    expect(codes(mapRequestApp(expr))).toEqual([]);
  });

  it("reports $route as an undefined name", () => {
    expect(codes(mapRequestApp("$route.path"))).toEqual(["E0103"]);
  });
});
