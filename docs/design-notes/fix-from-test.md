# `kumiki fix --auto-patch <test-name>` (v0.2 M4b)

[spec/testing.md](../spec/testing.md) §8.7.1 promised a mode that **proposes a fix patch** from a failing test: `kumiki fix --auto-patch <test-name>`. M4a shipped the [`test` layer + runner](./test-runner.md); M4b makes that promise real. This note records the scope decision — specifically, *which* test failures can be repaired deterministically, and why the rest are reported rather than guessed.

## The honesty constraint

A `test` definition that **fails** falls into one of two shapes, and only some are deterministically fixable:

- **It does not compile.** The `.kumiki` file (tests included) has a typecheck error, so the test cannot even run. This is the existing `planFixes` domain (`E0102`–`E0105` name typos, `E0001` missing `/404`).
- **It compiles but the result diverges from `expect`.** The reducer/tile is well-typed but produces a different value. *In general this is undecidable* — a reducer that did `count - 1` where the test expected `+1` has no recoverable "intended operator." Guessing here would be worse than reporting.

So `fix --auto-patch` repairs only what it can prove, and reports the diff for the rest (spec AC1 explicitly allows "a clear *no auto-patch available* with the diff").

## Two tiers

**Tier 1 — compile-blocked (reuse `planFixes`).** If the file does not compile, the named test can't run; repair the blocking typecheck errors via the existing `planFixes` path, then (in apply mode) re-run the test. This is spec AC3.

**Tier 2 — behavioral, deterministic literal repair.** If the file compiles and the named test **fails**, look at the failing **leaf** (the scalar at the divergence point the runner already computes). When the leaf is a **string** whose *actual* value appears **verbatim, exactly once** in the source as a string literal, the fix is unambiguous: replace that literal with the *expected* value. This is exactly the spec §8.7.1 snapshot case (`heading("Count: 5")` vs `heading("Count: 0")` — the rendered text came from a source literal). Uniqueness is what makes it deterministic: if the actual string isn't a verbatim literal (e.g. it was assembled by concatenation) it won't be found, and if it occurs more than once the target is ambiguous — both fall through to "no auto-patch".

This single rule covers both kinds:
- **tile-test** — a `.text` leaf diff whose actual text is a unique source literal (the canonical snapshot repair, spec AC2).
- **reducer-test** — a `slots.X` leaf diff where the slot is a **string** assigned from a unique literal.

Numeric/structural divergences (slot counts, effect lists, operator mistakes) are **not** literal-repairable and are reported.

## A side effect: the value arrow

To locate the literal, the runtime now carries the scalar leaf values (`TestResult.leaf = { expected, actual }`) alongside the existing serialized whole-tree `expected`/`actual` + `diffAt` path. That also lets `kumiki test` print the spec §8.7.1 value arrow:

```
FAIL  counter-display
  expected: column(heading("Count: 5"), row(...))
  actual:   column(heading("Count: 0"), row(...))
  diff at:  heading[0].text  "Count: 5" -> "Count: 0"
```

So M4b also removes the "per-leaf value arrow … not yet produced" caveat from [spec/testing.md](../spec/testing.md) §8.1. (Per-test timings and property-test case counts remain unimplemented.)

## CLI surface

`--apply` stays the single mutate gate, consistent with the existing `kumiki fix`:

```bash
kumiki fix <file> --auto-patch <test-name>           # dry-run: propose, do not write (AC4)
kumiki fix <file> --auto-patch <test-name> --apply   # apply, then re-run the test (AC5)
```

The dry-run prints the proposed patch; apply writes it, re-runs **all** tests, and reports whether the named test now passes and whether any other test regressed. (The spec writes the schematic form `kumiki fix --auto-patch <test-name>` without the file argument; the CLI always takes the file as the first positional.)

## Acceptance Criteria (M4b)

- AC1: `kumiki fix <file> --auto-patch <name>` resolves + runs the named test; on failure it produces ≥1 candidate patch, or a clear "no auto-patch available" plus the diff.
- AC2: A tile-test snapshot text mismatch whose actual text is a unique source literal yields a patch on the responsible literal; applying it makes the test pass.
- AC3: If the file does not compile, `fix` reuses `planFixes` to repair the blocking errors so the test can run.
- AC4: Without `--apply`, the command prints the proposed patch and does not modify the file.
- AC5: With `--apply`, the named test is re-run after patching; the output states whether it now passes and whether other tests regressed.
- AC6: A regression test covers the full loop: failing test → propose → apply → pass (compile-blocked and behavioral cases).
- AC7: The "planned for v0.2" sentence in `spec/testing.md` §8.7.1 is replaced with the shipped behavior; the §8.1 status note loses the value-arrow caveat.

## Deferred (follow-ups, tracked here)

- **Behavioral repair beyond unique string literals** — concatenated/interpolated text (align the literal slice against the dynamic parts), numeric slot mistakes, wrong operators, effect-list mismatches. These need intent inference or alignment heuristics that cannot guarantee correctness; reported as diffs today.
- **Multi-patch search** — trying several candidate edits and keeping the one that turns the test green (a search loop on top of the deterministic single-shot patch).
- **Scenario/smoke-driven fixes** — using a `kumiki run` trace or a `smoke` failure as the patch source (M4b consumes only `test` results).

These are additive and can land later with their own examples + tests, consistent with the repo's "answer with examples and tests" model.
