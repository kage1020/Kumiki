import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const COUNTER_PATH = resolve(here, "../../examples/apps/01-counter/app.kumiki");
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
    // The shipped runtime is the minified browser artifact: `mount` survives only
    // in the export map, and the file is well under the ~90KB unminified size.
    expect(runtime).toMatch(/export\s*\{[^}]*mount[^}]*\}/);
    expect(runtime.length).toBeLessThan(70_000);
    expect(runtime).not.toContain(": AppShape"); // type stripped
  });

  it("the built output mounts — app.js + minified runtime.js render into #root", {
    timeout: 30000,
  }, async () => {
    execFileSync("npx", ["tsx", CLI_PATH, "build", COUNTER_PATH, outDir], {
      stdio: "pipe",
      shell: true,
    });
    const root = document.createElement("div");
    root.id = "root";
    document.body.appendChild(root);
    try {
      // app.js auto-mounts into #root and imports "./runtime.js" relatively, so
      // this exercises the exact artifact pair `kumiki build` ships.
      await import(pathToFileURL(join(outDir, "app.js")).href);
      expect(root.textContent).toContain("Count: 0");
    } finally {
      root.remove();
    }
  });
});

// Regression (PR #15 review): `smoke`/`run` go through their own loadApp in
// src/smoke.ts, which must also thread the kumiki.caps.json capabilities.
// Otherwise a file using a manifest capability passes `check`/`build` but fails
// with E0302 before smoke/scenario can run.
describe("kumiki smoke with a manifest-registered capability", () => {
  const CUSTOM_CAP = resolve(here, "../../examples/features/27-custom-capability.kumiki");

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
  const TESTS = resolve(here, "../../examples/features/28-tests.kumiki");

  it("runs reducer-test + tile-test definitions and reports pass", { timeout: 30000 }, () => {
    const out = execFileSync("npx", ["tsx", CLI_PATH, "test", TESTS], {
      stdio: "pipe",
      shell: true,
      encoding: "utf8",
    });
    expect(out).toContain("PASS  inc-increments");
    expect(out).toContain("PASS  app-renders-count");
    expect(out).toContain("PASS  greeting-renders-input");
    expect(out).toContain("PASS  add-creates-item");
    expect(out).toContain("PASS  add-surfaces-persist-error");
    expect(out).toMatch(/PASS {2}inc-dec-roundtrips \(100 cases, \d+ms\)/);
    expect(out).toContain("7/7 passed");
  });

  it("filters by a name prefix", { timeout: 30000 }, () => {
    const out = execFileSync("npx", ["tsx", CLI_PATH, "test", TESTS, "inc-i*"], {
      stdio: "pipe",
      shell: true,
      encoding: "utf8",
    });
    expect(out).toContain("PASS  inc-increments");
    expect(out).toContain("1/1 passed");
    expect(out).not.toContain("dec-decrements");
  });

  it("reports per-test timings and a property case count (v0.6 M4)", { timeout: 30000 }, () => {
    const out = execFileSync("npx", ["tsx", CLI_PATH, "test", TESTS], {
      stdio: "pipe",
      shell: true,
      encoding: "utf8",
    });
    expect(out).toMatch(/PASS {2}inc-increments \(\d+ms\)/);
    expect(out).toMatch(/PASS {2}inc-dec-roundtrips \(100 cases, \d+ms\)/);
  });

  it("--coverage reports reducer / effect / tile coverage (v0.6 M4)", { timeout: 30000 }, () => {
    const out = execFileSync("npx", ["tsx", CLI_PATH, "test", TESTS, "--coverage"], {
      stdio: "pipe",
      shell: true,
      encoding: "utf8",
    });
    expect(out).toContain("coverage");
    expect(out).toMatch(/reducers {2}4\/4/);
    expect(out).toMatch(/tiles {5}2\/5/);
    expect(out).toContain("uncovered:");
  });
});

// M4b: `kumiki fix --auto-patch <test-name>`. These exercise the real CLI wiring
// (subprocess) so the in-process DOM of the test runner stays isolated.
describe("kumiki fix --auto-patch (fix from a failing test)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "kumiki-fixtest-"));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  /** Run the CLI, capturing stdout+stderr and the exit code without throwing. */
  function runCli(args: string[]): { out: string; code: number } {
    try {
      const out = execFileSync("npx", ["tsx", CLI_PATH, ...args], {
        stdio: "pipe",
        shell: true,
        encoding: "utf8",
      });
      return { out, code: 0 };
    } catch (e) {
      const err = e as { stdout?: string; stderr?: string; status?: number };
      return { out: `${err.stdout ?? ""}${err.stderr ?? ""}`, code: err.status ?? 1 };
    }
  }

  // A tile-test whose rendered text comes from a single typo'd source literal.
  const BEHAVIORAL = `tile Title = heading("Helo")
tile App = column(Title)
app FixDemo
    caps   = []
    routes = {"/" -> App, "/404" -> App}
    init   = []
test title-text =
    tile-test Title
        given  = {slots: {}}
        expect = heading("Hello")
`;

  it("dry-run proposes the literal patch and does not modify the file", { timeout: 30000 }, () => {
    const file = join(dir, "behavioral.kumiki");
    writeFileSync(file, BEHAVIORAL);
    const { out, code } = runCli(["fix", file, "--auto-patch", "title-text"]);
    expect(code).toBe(0);
    expect(out).toContain('replace "Helo" with "Hello"');
    // File untouched (AC4).
    expect(readFileSync(file, "utf8")).toContain('heading("Helo")');
  });

  it("--apply patches the literal and the test then passes", { timeout: 30000 }, () => {
    const file = join(dir, "behavioral.kumiki");
    writeFileSync(file, BEHAVIORAL);
    const { out, code } = runCli(["fix", file, "--auto-patch", "title-text", "--apply"]);
    expect(code).toBe(0);
    expect(out).toContain("PASSES");
    const after = readFileSync(file, "utf8");
    expect(after).toContain('heading("Hello")');
    expect(after).not.toContain('"Helo"');
    // The runner now agrees the test passes.
    const verify = runCli(["test", file]);
    expect(verify.out).toContain("PASS  title-text");
    expect(verify.out).toContain("1/1 passed");
  });

  it("repairs a compile error blocking the test, then runs it (AC3)", { timeout: 30000 }, () => {
    const file = join(dir, "compile-blocked.kumiki");
    writeFileSync(
      file,
      `slot count : Int = 0
reducer inc on=ui.click(IncBtn) do= conut := count + 1
tile IncBtn = button(text="+1", onClick=inc)
tile App = column(heading("Count: " + count.show), IncBtn)
app FixDemo
    caps   = []
    routes = {"/" -> App, "/404" -> App}
    init   = []
test inc-works =
    reducer-test inc
        given  = {slots: {count: 0}, event: {type: ui.click, target: IncBtn}}
        expect = {slots: {count: 1}, effects: []}
`,
    );
    const { out, code } = runCli(["fix", file, "--auto-patch", "inc-works", "--apply"]);
    expect(code).toBe(0);
    expect(out).toContain("compile fix");
    const after = readFileSync(file, "utf8");
    expect(after).toContain("count := count + 1");
    expect(after).not.toContain("conut");
    // Test runs and passes on the repaired file.
    const verify = runCli(["test", file]);
    expect(verify.out).toContain("PASS  inc-works");
  });

  it("reports 'no auto-patch available' for a non-literal mismatch (AC1)", {
    timeout: 30000,
  }, () => {
    const file = join(dir, "no-patch.kumiki");
    const source = `slot count : Int = 0
reducer dec on=ui.click(DecBtn) do= count := count - 1
tile DecBtn = button(text="-1", onClick=dec)
tile App = column(heading("Count: " + count.show), DecBtn)
app FixDemo
    caps   = []
    routes = {"/" -> App, "/404" -> App}
    init   = []
test dec-should-add =
    reducer-test dec
        given  = {slots: {count: 0}, event: {type: ui.click, target: DecBtn}}
        expect = {slots: {count: 1}, effects: []}
`;
    writeFileSync(file, source);
    const { out, code } = runCli(["fix", file, "--auto-patch", "dec-should-add", "--apply"]);
    expect(code).toBe(1);
    expect(out).toContain("no auto-patch available");
    // File untouched — no guessing.
    expect(readFileSync(file, "utf8")).toBe(source);
  });

  // Regression (PR #18 review, Codex P2): when the failing text comes from the
  // test's own `given` data, the literal lives only in the `test` body. Patching
  // it would fake a PASS without fixing any production definition — so test
  // bodies are excluded from the literal search and no patch is offered.
  it("does not patch a literal that lives only in a test fixture", { timeout: 30000 }, () => {
    const file = join(dir, "fixture-only.kumiki");
    const source = `slot msg : Text = "x"
tile Msg = heading(msg.show)
tile App = column(Msg)
app FixDemo
    caps   = []
    routes = {"/" -> App, "/404" -> App}
    init   = []
test msg-text =
    tile-test Msg
        given  = {slots: {msg: "Helo"}}
        expect = heading("Hello")
`;
    writeFileSync(file, source);
    const { out, code } = runCli(["fix", file, "--auto-patch", "msg-text", "--apply"]);
    expect(code).toBe(1);
    expect(out).toContain("no auto-patch available");
    // The fixture's "Helo" must be left intact — no self-mutating PASS.
    expect(readFileSync(file, "utf8")).toBe(source);
  });
});
