// Every example under examples/ must parse, typecheck, and build (codegen +
// runtime inlining). This is the guard behind the repo's operating model:
// questions and bug reports are answered by adding an example, and a broken
// example must never merge.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { compile, type KumikiError } from "@kumikijs/compiler";
import { nodeRuntimeBundleReader } from "@kumikijs/compiler/node";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const examplesDir = join(here, "..", "examples");

function listFeatureExamples(): string[] {
  const dir = join(examplesDir, "features");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".kumiki"))
    .map((f) => join(dir, f));
}

function listAppExamples(): string[] {
  const dir = join(examplesDir, "apps");
  return readdirSync(dir)
    .map((name) => join(dir, name))
    .filter((p) => statSync(p).isDirectory())
    .map((p) => join(p, "app.kumiki"))
    .filter((p) => {
      try {
        return statSync(p).isFile();
      } catch {
        return false;
      }
    });
}

function fmtErrors(errors: KumikiError[]): string {
  return errors
    .map((e) => `${e.code} ${e.kind} @ ${e.pos.line}:${e.pos.col}: ${e.message}`)
    .join("\n");
}

function expectCompiles(file: string): void {
  const source = readFileSync(file, "utf8");
  const result = compile(source, {
    runtimeSpecifier: "./runtime.js",
    bundle: true,
    readRuntimeBundle: nodeRuntimeBundleReader,
  });
  if (result.kind === "fail") {
    throw new Error(`${file} failed to compile:\n${fmtErrors(result.errors)}`);
  }
  expect(result.js.length).toBeGreaterThan(0);
}

describe("feature examples", () => {
  const files = listFeatureExamples();
  it("there are feature examples to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });
  for (const file of files) {
    it(`compiles ${file.split(/[\\/]/).slice(-1)[0]}`, () => {
      expectCompiles(file);
    });
  }
});

describe("app examples", () => {
  const files = listAppExamples();
  it("there are app examples to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });
  for (const file of files) {
    const label = file.split(/[\\/]/).slice(-2).join("/");
    it(`compiles ${label}`, () => {
      expectCompiles(file);
    });
  }
});
