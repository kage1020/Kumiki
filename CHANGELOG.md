# Changelog

English · [日本語](./CHANGELOG.ja.md)

The format follows [Keep a Changelog](https://keepachangelog.com/) and adopts [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- pnpm + Turborepo monorepo structure (`@strand/compiler` / `@strand/runtime` / `@strand/cli` / `@strand/mcp`).
- `@strand/mcp`: an MCP server exposing the compiler, AI editing, and spec search as MCP tools.
- **Runtime smoke tests**: `@strand/runtime`'s `smoke()`, CLI `strand smoke <file>`, MCP `strand_smoke`. Mounts to a headless DOM and operates the UI to detect runtime exceptions, empty rendering, and unhandled rejections that `check`/`build` don't catch. All examples are smoke-verified in CI (`tests/smoke.test.ts`). The 3-layer verification model is in [spec/testing.md](./spec/testing.md) §8.10.
- **Scenario runner and autonomous-loop substrate**: `@strand/runtime`'s `runScenario()`, CLI `strand run <file> <scenario.json>`, MCP `strand_run_scenario`. Drives the app with an operation sequence + slot state assertions, returning the state, DOM, errors, and emits at every step as a trace. Effects are mocked at the capability boundary and are deterministic. Because state is used as the oracle, it can also detect non-exception bugs such as "select always ends up at the last option". The procedure for the human-free generate → run → observe → fix loop is in `.claude/skills/strand-iterate`.
- **Real-browser verification tier `@strand/e2e`** (Chromium / Playwright): runs the same scenario format as jsdom in a real browser, capturing layers that jsdom can't verify such as `focused` (real focus), `visible`/`hidden` (computed visibility). Opt-in (browser binaries are heavy, so it's not included in default CI). Example: `examples/apps/06-expenses/scenario.browser.json`.
- `spec/`: reorganized the normative spec. Added a new error code catalog `spec/errors.md` (E0001..E07xx).
- `examples/`: 23 per-feature minimal examples (`features/`) and 5 apps ordered by size (`apps/`). All have parsing, type checking, and build verified in CI.
- `tests/`: behavior-guarantee tests for all examples.
- `guide/`: getting started, first app, mental model, recipes.
- `.claude/skills/`: `strand-author` / `strand-debug` / `strand-iterate` skills.
- `design-notes/`: consolidates design rationale and benchmarks (learning cost v1–v4, token efficiency vs. React).
- **Static method existence check (E0801)**: when `obj.method(...)` calls a method not implemented in the runtime (a typo, misuse like `Option.to-result`, or an unimplemented spec method), it is detected at the `check` stage. The implementation set is the single source of truth in `@strand/compiler`'s `KNOWN_METHODS` (kept in sync with codegen). It catches `.to-result`-class bugs — previously caught only at the smoke layer — at layer 1.
- **`List.fold` / `Int` / `Float.parse` fixes** (found while demoing the iterate loop): implemented `fold`'s codegen + runtime, and fixed `Int.parse`/`Float.parse` to do numeric conversion (previously they returned strings, breaking sums and the like). Examples: `examples/features/24-fold.strand`, `examples/apps/06-expenses/`.

### Changed

- Changed the one-reducer-one-write rule from route-name granularity to **path-shape (lvalue shape) granularity**. `tasks[id].status` and `tasks[id].updatedAt` can now coexist.
- Runtime: guard so that delayed effect results after dispose don't touch the DOM (resolves `NotFoundError` caused by in-flight fetches).
- AST: renamed the fields of `IfStmt` / `IfExpr` / `TileIf` from `then`/`else` → `consequent`/`alternate`.

### Notes

- experimental v0.1. The language, runtime, and tools may change without notice.
