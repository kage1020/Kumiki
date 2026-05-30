import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compile } from "@strand/compiler";
import { describe, expect, it } from "vitest";

const COUNTER_PATH = resolve(__dirname, "../../../examples/apps/01-counter/app.strand");

describe("codegen", () => {
  it("compiles counter to a runnable JS module", () => {
    const src = readFileSync(COUNTER_PATH, "utf8");
    const result = compile(src, { runtimeSpecifier: "./runtime.js" });
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.js).toMatch(/import \{ mount[^}]*\} from "\.\/runtime\.js"/);
    expect(result.js).toContain('"count":');
    expect(result.js).toContain("_reducers");
    expect(result.js).toContain("__strandApp._dispatch");
  });
});
