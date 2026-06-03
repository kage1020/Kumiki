import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const COUNTER_PATH = resolve(here, "../../../examples/apps/01-counter/app.kumiki");
const CLI_PATH = resolve(here, "../src/kumiki.ts");

describe("kumiki build CLI", () => {
  let outDir: string;

  beforeEach(() => {
    outDir = mkdtempSync(join(tmpdir(), "kumiki-cli-"));
  });

  afterEach(() => {
    rmSync(outDir, { recursive: true, force: true });
  });

  it("produces index.html, app.js, runtime.js from the counter example", { timeout: 30000 }, () => {
    execFileSync("npx", ["tsx", CLI_PATH, "build", COUNTER_PATH, outDir], {
      stdio: "pipe",
      shell: true,
    });
    expect(existsSync(join(outDir, "index.html"))).toBe(true);
    expect(existsSync(join(outDir, "app.js"))).toBe(true);
    expect(existsSync(join(outDir, "runtime.js"))).toBe(true);

    const html = readFileSync(join(outDir, "index.html"), "utf8");
    expect(html).toContain('<div id="root"></div>');
    expect(html).toContain('<script type="module" src="/app.js"></script>');

    const app = readFileSync(join(outDir, "app.js"), "utf8");
    expect(app).toMatch(/import \{ mount[^}]*\} from "\.\/runtime\.js"/);
    expect(app).toContain('tile: "IncBtn"');
    expect(app).toContain('__kumikiApp._dispatch("inc"');

    const runtime = readFileSync(join(outDir, "runtime.js"), "utf8");
    expect(runtime).toContain("function mount");
    expect(runtime).toMatch(/export\s*\{[^}]*mount[^}]*\}/);
    expect(runtime).not.toContain(": AppShape"); // type stripped
  });
});

// Regression (PR #15 review): `smoke`/`run` go through their own loadApp in
// src/smoke.ts, which must also thread the kumiki.caps.json capabilities.
// Otherwise a file using a manifest capability passes `check`/`build` but fails
// with E0302 before smoke/scenario can run.
describe("kumiki smoke with a manifest-registered capability", () => {
  const CUSTOM_CAP = resolve(here, "../../../examples/features/27-custom-capability.kumiki");

  it("smokes a file whose capability is declared in kumiki.caps.json", { timeout: 30000 }, () => {
    const out = execFileSync("npx", ["tsx", CLI_PATH, "smoke", CUSTOM_CAP], {
      stdio: "pipe",
      shell: true,
      encoding: "utf8",
    });
    expect(out).toContain("ok");
  });
});

describe("kumiki test (in-language test runner)", () => {
  const TESTS = resolve(here, "../../../examples/features/28-tests.kumiki");

  it("runs reducer-test + tile-test definitions and reports pass", { timeout: 30000 }, () => {
    const out = execFileSync("npx", ["tsx", CLI_PATH, "test", TESTS], {
      stdio: "pipe",
      shell: true,
      encoding: "utf8",
    });
    expect(out).toContain("PASS  inc-increments");
    expect(out).toContain("PASS  app-renders-count");
    expect(out).toContain("PASS  greeting-renders-input");
    expect(out).toContain("4/4 passed");
  });

  it("filters by a name prefix", { timeout: 30000 }, () => {
    const out = execFileSync("npx", ["tsx", CLI_PATH, "test", TESTS, "inc*"], {
      stdio: "pipe",
      shell: true,
      encoding: "utf8",
    });
    expect(out).toContain("PASS  inc-increments");
    expect(out).toContain("1/1 passed");
    expect(out).not.toContain("dec-decrements");
  });
});
