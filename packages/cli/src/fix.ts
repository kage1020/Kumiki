// kumiki fix — propose auto-patches for repairable typecheck errors.

import { readFileSync, writeFileSync } from "node:fs";
import type { KumikiError } from "@kumikijs/compiler";
import { check, lex, parse } from "@kumikijs/compiler";
import type { TestResult } from "@kumikijs/runtime";
import { testFile } from "./smoke.ts";
import { listDefs, load, type Store } from "./store.ts";

export type AutoPatch = {
  code: string;
  message: string;
  /** Free-form description of the fix to be applied. */
  description: string;
  apply: (text: string) => string;
};

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // Rolling single-row DP — `prev` holds the previous row's distances.
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i, ...new Array<number>(n).fill(0)];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min((prev[j] ?? 0) + 1, (curr[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = curr;
  }
  return prev[n] ?? 0;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function suggestName(store: Store, missing: string): string | null {
  const all = listDefs(store).map((e) => e.name);
  let best: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const cand of all) {
    const d = levenshtein(missing, cand);
    if (d < bestScore) {
      bestScore = d;
      best = cand;
    }
  }
  // Accept the suggestion only if the names are close enough (≤ 2 edits or ≤ 25%).
  if (best === null) return null;
  if (bestScore <= 2 || bestScore <= Math.ceil(missing.length * 0.25)) return best;
  return null;
}

export function planFixes(store: Store, errors: KumikiError[]): AutoPatch[] {
  const patches: AutoPatch[] = [];
  for (const err of errors) {
    if (
      err.code === "E0103" ||
      err.code === "E0105" ||
      err.code === "E0102" ||
      err.code === "E0104"
    ) {
      const match = /"([^"]+)"/.exec(err.message);
      if (!match) continue;
      const missing = match[1]!;
      const suggested = suggestName(store, missing);
      if (!suggested) continue;
      patches.push({
        code: err.code,
        message: err.message,
        description: `replace "${missing}" with "${suggested}" at ${err.pos.line}:${err.pos.col}`,
        apply: (text: string) => {
          const lines = text.split(/\r?\n/);
          const idx = err.pos.line - 1;
          const line = lines[idx] ?? "";
          const re = new RegExp(`\\b${escapeRegex(missing)}\\b`);
          lines[idx] = line.replace(re, suggested);
          return lines.join("\n");
        },
      });
    }
    if (err.code === "E0001") {
      patches.push({
        code: err.code,
        message: err.message,
        description: `add "/404" -> NotFound to app.routes (you must define a NotFound tile)`,
        apply: (text: string) => {
          // Append a NotFound tile + extend routes
          const need = `\ntile NotFound = page(heading("404"))\n`;
          // Inject "/404" -> NotFound before the closing brace of `routes = { ... }`.
          const re = /(routes\s*=\s*\{)([^}]*)(\})/;
          const replaced = text.replace(re, (_m, open: string, body: string, close: string) => {
            if (body.includes('"/404"')) return `${open}${body}${close}`;
            const trimmed = body.trimEnd();
            const sep = trimmed.endsWith(",") || trimmed.endsWith("{") ? "" : ",";
            return `${open}${body}${sep} "/404" -> NotFound ${close}`;
          });
          return need + replaced;
        },
      });
    }
  }
  return patches;
}

export function fixCmd(
  path: string,
  apply: boolean,
  onlyCode?: string,
  capabilities: string[] = [],
): void {
  const store = load(path);
  // Thread manifest capabilities so a file using a registered cap is not falsely
  // reported as E0302 (and so the planned patches match what `check`/`build` see).
  const errors = check(store.program, { capabilities });
  if (errors.length === 0) {
    console.log("no errors");
    return;
  }
  let patches = planFixes(store, errors);
  if (onlyCode) patches = patches.filter((p) => p.code === onlyCode);
  if (patches.length === 0) {
    console.log("(no auto-patches available)");
    for (const e of errors) console.error(`${e.code} ${e.message}`);
    return;
  }
  if (!apply) {
    for (const p of patches) {
      console.log(`${p.code} ${p.message}`);
      console.log(`  fix: ${p.description}`);
    }
    return;
  }
  let text = readFileSync(path, "utf8");
  for (const p of patches) {
    text = p.apply(text);
  }
  writeFileSync(path, text);
  // Re-validate
  try {
    const next = parse(lex(text));
    const after = check(next, { capabilities });
    if (after.length === 0) console.log(`applied ${patches.length} fix(es) — file now clean`);
    else console.log(`applied ${patches.length} fix(es) — ${after.length} error(s) remain`);
  } catch (e) {
    console.error(`fixes broke the file: ${String(e)}`);
  }
}

// ----- `kumiki fix --auto-patch <test-name>` (M4b) -----
//
// Repair a `.kumiki` file from a failing `test` definition. Two tiers:
//   1. compile-blocked — the file doesn't typecheck, so the test can't run;
//      reuse `planFixes` to clear the blocking errors first.
//   2. behavioral — the file compiles but the test fails; apply a deterministic
//      literal repair when one is provable (see `planTestPatch`), else report.
// See design-notes/fix-from-test.md.

export type FixFromTestOutcome = {
  /** true when the named test ends up passing, or a fix is available in dry-run. */
  ok: boolean;
  status:
    | "not-found"
    | "already-pass"
    | "proposed"
    | "applied"
    | "no-patch"
    | "compile-proposed"
    | "compile-remaining";
  /** Post-apply status of the named test, when an apply happened. */
  pass?: boolean;
  /** The behavioral patch proposed or applied. */
  patch?: AutoPatch;
  /** Count of Tier-1 compile fixes proposed or applied. */
  compileFixes?: number;
  /** Names of other tests that regressed after applying. */
  regressed?: string[];
};

/**
 * Render a string as a Kumiki source literal, or null if it needs an escape the
 * lexer can't represent. The lexer supports only `\n` / `\t` / `\r` / `\"` /
 * `\\` (lexer.ts) — emitting a JSON `\uXXXX` (e.g. for a control char) would
 * produce an invalid `.kumiki` file, so we bail rather than write garbage.
 */
function kumikiStringLit(s: string): string | null {
  let out = '"';
  for (const ch of s) {
    const code = ch.codePointAt(0) ?? 0;
    if (ch === "\\") out += "\\\\";
    else if (ch === '"') out += '\\"';
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\r") out += "\\r";
    else if (code < 0x20)
      return null; // control char Kumiki cannot escape
    else out += ch;
  }
  return `${out}"`;
}

/** 1-based line number of a character offset in `source`. */
function lineOfOffset(source: string, offset: number): number {
  let line = 1;
  const end = Math.min(offset, source.length);
  for (let i = 0; i < end; i++) if (source[i] === "\n") line++;
  return line;
}

/**
 * A deterministic patch from a failing test, when one is provable: the failing
 * leaf is a string whose *actual* value appears verbatim, exactly once, as a
 * source string literal **in implementation code** (tile / reducer), not in a
 * `test` body. `excludedLineRanges` are the 1-based inclusive line spans of the
 * file's `test` definitions; a match inside one is skipped, because patching a
 * test's own `given` / `expect` data would mutate the fixture into passing
 * without touching any production definition. Returns null when no such patch
 * exists — the caller reports the diff instead.
 */
export function planTestPatch(
  source: string,
  r: TestResult,
  excludedLineRanges: Array<[number, number]> = [],
): AutoPatch | null {
  if (r.pass || !r.leaf) return null;
  const { expected, actual } = r.leaf;
  if (typeof actual !== "string" || typeof expected !== "string" || actual === expected) {
    return null;
  }
  const actualLit = kumikiStringLit(actual);
  const expectedLit = kumikiStringLit(expected);
  if (actualLit === null || expectedLit === null) return null;

  // Collect occurrences outside any `test` body. Determinism requires exactly
  // one: assembled text (concatenation) is never found; a fixture-only literal
  // yields zero implementation hits; duplicates are ambiguous — all → null.
  const inExcluded = (offset: number): boolean => {
    const line = lineOfOffset(source, offset);
    return excludedLineRanges.some(([lo, hi]) => line >= lo && line <= hi);
  };
  const hits: number[] = [];
  for (let idx = source.indexOf(actualLit); idx !== -1; idx = source.indexOf(actualLit, idx + 1)) {
    if (!inExcluded(idx)) hits.push(idx);
  }
  if (hits.length !== 1) return null;
  const hit = hits[0]!;
  const at = r.diffAt ?? "(leaf)";
  return {
    code: "TEST",
    message: `test "${r.name}" failed at ${at}`,
    description: `replace ${actualLit} with ${expectedLit} (from failing test "${r.name}" @ ${at})`,
    // Positional splice at the proven offset — avoids String.replace's first-
    // match-anywhere (which could hit a test body) and `$`-substitution.
    apply: (text: string) => text.slice(0, hit) + expectedLit + text.slice(hit + actualLit.length),
  };
}

/** 1-based inclusive line spans of every `test` definition in `store`. */
function testBodyLineRanges(store: Store): Array<[number, number]> {
  return store.defs
    .filter((e) => e.def.kind === "TestDef")
    .map((e): [number, number] => [e.range.startLine, e.range.endLine]);
}

export async function fixFromTest(
  path: string,
  testName: string,
  apply: boolean,
  capabilities: string[] = [],
): Promise<FixFromTestOutcome> {
  // Tier 1: a file that doesn't compile can't run its tests — repair first.
  const store = load(path);
  const compileErrors = check(store.program, { capabilities });
  let compileFixes = 0;
  if (compileErrors.length > 0) {
    const patches = planFixes(store, compileErrors);
    if (patches.length === 0) {
      console.log(
        `(no auto-patch available) — test "${testName}" is blocked by ${compileErrors.length} compile error(s):`,
      );
      for (const e of compileErrors) console.error(`  ${e.code} ${e.message}`);
      return { ok: false, status: "no-patch" };
    }
    if (!apply) {
      console.log(`test "${testName}" is blocked by compile errors; proposed fixes (dry-run):`);
      for (const p of patches) {
        console.log(`  ${p.code} ${p.message}`);
        console.log(`    fix: ${p.description}`);
      }
      return { ok: true, status: "compile-proposed", compileFixes: patches.length };
    }
    let text = readFileSync(path, "utf8");
    for (const p of patches) text = p.apply(text);
    writeFileSync(path, text);
    compileFixes = patches.length;
    // Guard the re-check: a patch could (defensively) yield invalid syntax, and
    // the file is already written — surface that instead of throwing.
    let remaining: ReturnType<typeof check>;
    try {
      remaining = check(parse(lex(text)), { capabilities });
    } catch (e) {
      console.log(
        `applied ${compileFixes} compile fix(es) but they broke the file (${String(e)}); cannot run "${testName}"`,
      );
      return { ok: false, status: "compile-remaining", compileFixes };
    }
    if (remaining.length > 0) {
      console.log(
        `applied ${compileFixes} compile fix(es) — ${remaining.length} error(s) remain; cannot run "${testName}"`,
      );
      return { ok: false, status: "compile-remaining", compileFixes };
    }
    console.log(`applied ${compileFixes} compile fix(es) — file now compiles`);
  }

  // Run the tests on the (now-compiling) file.
  let before: TestResult[];
  try {
    before = await testFile(path, capabilities);
  } catch (e) {
    console.error(`could not run tests: ${String(e)}`);
    return { ok: false, status: "no-patch", ...(compileFixes ? { compileFixes } : {}) };
  }
  const target = before.find((r) => r.name === testName);
  if (!target) {
    const have = before.map((r) => r.name).join(", ") || "none";
    console.error(`no test named "${testName}" (have: ${have})`);
    return { ok: false, status: "not-found", ...(compileFixes ? { compileFixes } : {}) };
  }
  if (target.pass) {
    console.log(`test "${testName}" passes — nothing to fix`);
    return {
      ok: true,
      status: "already-pass",
      pass: true,
      ...(compileFixes ? { compileFixes } : {}),
    };
  }

  // Tier 2: behavioral, deterministic literal repair. Re-load from the current
  // (possibly Tier-1-patched) file so the source and the `test` body line ranges
  // used to exclude fixture literals are consistent.
  const curSource = readFileSync(path, "utf8");
  const patch = planTestPatch(curSource, target, testBodyLineRanges(load(path)));
  if (!patch) {
    console.log(`(no auto-patch available) for failing test "${testName}":`);
    if (target.expected !== undefined) console.log(`  expected: ${target.expected}`);
    if (target.actual !== undefined) console.log(`  actual:   ${target.actual}`);
    if (target.diffAt !== undefined) console.log(`  diff at:  ${target.diffAt}`);
    return { ok: false, status: "no-patch", ...(compileFixes ? { compileFixes } : {}) };
  }
  if (!apply) {
    console.log(`proposed fix for "${testName}" (dry-run):`);
    console.log(`  ${patch.description}`);
    return { ok: true, status: "proposed", patch, ...(compileFixes ? { compileFixes } : {}) };
  }
  writeFileSync(path, patch.apply(curSource));
  const after = await testFile(path, capabilities);
  const nowPass = after.find((r) => r.name === testName)?.pass === true;
  const regressed = after
    .filter((r) => !r.pass && before.find((b) => b.name === r.name)?.pass === true)
    .map((r) => r.name);
  console.log(`applied fix — test "${testName}" now ${nowPass ? "PASSES" : "still FAILS"}`);
  if (regressed.length > 0) {
    console.log(`  WARNING: ${regressed.length} other test(s) regressed: ${regressed.join(", ")}`);
  }
  return {
    ok: nowPass && regressed.length === 0,
    status: "applied",
    pass: nowPass,
    patch,
    ...(compileFixes ? { compileFixes } : {}),
    ...(regressed.length ? { regressed } : {}),
  };
}
