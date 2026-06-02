# `test` layer & `kumiki test` runner (v0.2 M4)

English · [日本語](./test-runner.ja.md)

[spec/testing.md](../spec/testing.md) §8 describes an in-language `test` definition layer (reducer-test / tile-test / property-test / episode-test) and a `kumiki test` runner. **None of it was implemented** — there was no `test` keyword, no AST node, and no runner; the repo's actual layer-3 verification was scenarios (`runScenario`) + smoke. M4 implements the runner + DSL so `test` definitions become real, then (M4b) `kumiki fix --auto-patch <test-name>` builds on it. This note records the scope decision.

## Scope

**Implemented now (M4a):**

- The `test` definition layer: `test <name> = <test-expr>`. Stored like any definition; **excluded from the production build** (codegen emits tests to a separate `__kumikiTests`, never mounted).
- **reducer-test** — `given = {slots, event}` → apply the named reducer once → `expect = {slots, effects}` (compare resulting slot values + emitted effect calls). Plus the panic form `expect = {panic: "msg"}`.
- **tile-test** — `given = {slots, in?}` → render the named tile (passing `in` as `$1`) → compare its structure to an `expect = <tile-expr>` (deep structural compare of the tile tree; only explicitly-specified props are compared, per spec §8.4).
- **`kumiki test [filter]`** runner — discovers test definitions, runs each, prints the spec §8.7.1 PASS/FAIL output with a structural diff on failure, exits non-zero on any failure. `filter` is an exact name or a `prefix-*` wildcard.

**Deferred (follow-ups, tracked here):**

- **Wildcards** in `expect` (`<any-id>`, `<slots.X>` back-references) — needs lexer/parser support for `<…>` in value position. M4a requires exact expected values.
- **Effect-result mocks inside reducer-test** (spec §8.5 multi-step flow) — a reducer-test in M4a is a single pure `apply`; the effect-round-trip flow (mock an effect's result so a `.ok` reducer runs) is deferred (the scenario runner already covers that shape).
- **property-test** (type-driven generators + shrinking, §8.3) and **episode-test** (log replay, §8.6).
- **`--watch` / `--coverage`** (§8.7).

These are additive; each can land later with its own examples + tests, consistent with the repo's "answer with examples and tests" model.

## Execution model

`codegen` emits a `__kumikiTests` array next to `__kumikiApp`, each entry `{ name, kind, run() }`. `run()` closes over the app's compiled reducers/tiles:

- **reducer-test**: build the event payload from `given.event`, call the reducer's `apply(given.slots, payload)`, and structurally compare `{slots, effects}` against the compiled `expect` (or assert the expected panic was thrown).
- **tile-test**: seed `given.slots`, invoke the tile thunk to get the actual `TileNode`, compile `expect` to the expected `TileNode`, and structurally compare (ignoring props not present in `expect`).

`given`/`expect` values reuse the normal expression codegen, so records / lists / variants / literals evaluate exactly as in the app. The `kumiki test` command bundles the module (like `build`), imports it, runs `__kumikiTests`, and renders the report. The comparison + diff live in `@kumikijs/runtime` (`runTests`), so the CLI and a future `fix --auto-patch` share one oracle.

## Acceptance Criteria (M4a)

- AC1: `test t = reducer-test R given={slots,event} expect={slots,effects}` parses into a `TestDef`; an unknown reducer/tile reference is a compile error (E0102 / E0105).
- AC2: `kumiki test` runs every `test` definition and prints `PASS <name>` / `FAIL <name>` with an `expected` / `actual` / `diff at` block on failure (spec §8.7.1); exit code is non-zero iff any test failed.
- AC3: A reducer-test passes when the reducer's resulting slots + emitted effects match `expect`, and fails (with a diff) when they don't.
- AC4: `expect = {panic: "msg"}` passes iff the reducer panics with that message.
- AC5: A tile-test passes when the rendered tile structure matches `expect`, comparing only the props named in `expect`.
- AC6: `kumiki test <name>` / `kumiki test <prefix>-*` filters which tests run.
- AC7: Test definitions are excluded from `kumiki build` output (production bundle has no `__kumikiTests`… or it is inert and unmounted).
- AC8: New examples carrying `test` definitions pass `check` + `build` + `kumiki test`; the runner itself has unit coverage. `spec/testing.md` §8 marks the implemented core and lists the deferred kinds.

## After M4a

M4b implements `kumiki fix --auto-patch <test-name>` ([roadmap](./roadmap-v0.2.md) M4): run the named test, and on a failure that maps to a known fixable error code reuse `planFixes` to propose/apply/re-run; report a clear diff when no deterministic patch applies.
