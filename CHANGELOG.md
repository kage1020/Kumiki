# Changelog

English · [日本語](./CHANGELOG.ja.md)

The format follows [Keep a Changelog](https://keepachangelog.com/) and adopts [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Planned — v0.2

Scope, design, and acceptance criteria: [design-notes/roadmap-v0.2.md](./design-notes/roadmap-v0.2.md). Five items the spec already marks "planned for v0.2", shipped as independent milestones (M1–M5). M1–M2 are shipped (see _Added_ below):

- **M3 — Plugin capability registration**: a declarative manifest to register custom capabilities + effects without forking the compiler (`spec/stdlib.md §2.5`).
- **M4 — `kumiki fix --auto-patch <test-name>`**: extend `fix` from typecheck errors to test failures, proposing and applying source patches (`spec/testing.md §8.7.1`).
- **M5 — `motion` layer**: declarative, scoped transitions / keyframes with no global-CSS escape hatch (`spec/style.md §4.9`).

### Added

- **v0.2 M2 — `overlay` builtin**: z-axis stacking via `overlay(...children)`. The first child is the base layer (normal flow); each later child is placed absolutely over the container (so the base layout never shifts) — the substrate for modals / toasts / dropdowns / tooltips. The `align` prop positions overlaid children (vertical `top`/`bottom` + horizontal `left`/`right` joined with `-`, e.g. `top-left`; default `center`; unknown → `center`). Composes with `when(...)` for mount/unmount; CSS is self-contained (no global-CSS escape hatch). New example `examples/features/26-overlay.kumiki`. ([spec/style.md](./spec/style.md) §4.4.3)
- **v0.2 M1 — `stop-timer(name)`**: a timer trigger can be named with `timer(d, name=N)`, and a reducer can stop it with the `stop-timer(N)` statement. Timer names share one namespace and must be unique (duplicate → **E0002**); a `stop-timer` to an undeclared name is **E0106**. `stop-timer` is a pure control statement — the reducer returns `stopTimers` and the runtime clears the interval, so reducer purity is preserved. All timers (running or stopped) are cleared on `app` dispose. New example `examples/features/25-stop-timer.kumiki`. ([spec/lifecycle.md](./spec/lifecycle.md) §7.1.5)
- pnpm + Turborepo monorepo structure (`@kumiki/compiler` / `@kumiki/runtime` / `@kumiki/cli` / `@kumiki/mcp`).
- `@kumiki/mcp`: an MCP server exposing the compiler, AI editing, and spec search as MCP tools.
- **Runtime smoke tests**: `@kumiki/runtime`'s `smoke()`, CLI `kumiki smoke <file>`, MCP `kumiki_smoke`. Mounts to a headless DOM and operates the UI to detect runtime exceptions, empty rendering, and unhandled rejections that `check`/`build` don't catch. All examples are smoke-verified in CI (`tests/smoke.test.ts`). The 3-layer verification model is in [spec/testing.md](./spec/testing.md) §8.10.
- **Scenario runner and autonomous-loop substrate**: `@kumiki/runtime`'s `runScenario()`, CLI `kumiki run <file> <scenario.json>`, MCP `kumiki_run_scenario`. Drives the app with an operation sequence + slot state assertions, returning the state, DOM, errors, and emits at every step as a trace. Effects are mocked at the capability boundary and are deterministic. Because state is used as the oracle, it can also detect non-exception bugs such as "select always ends up at the last option". The procedure for the human-free generate → run → observe → fix loop is in `.claude/skills/kumiki-iterate`.
- **Real-browser verification tier `@kumiki/e2e`** (Chromium / Playwright): runs the same scenario format as jsdom in a real browser, capturing layers that jsdom can't verify such as `focused` (real focus), `visible`/`hidden` (computed visibility). Opt-in (browser binaries are heavy, so it's not included in default CI). Example: `examples/apps/06-expenses/scenario.browser.json`.
- `spec/`: reorganized the normative spec. Added a new error code catalog `spec/errors.md` (E0001..E07xx).
- `examples/`: 23 per-feature minimal examples (`features/`) and 5 apps ordered by size (`apps/`). All have parsing, type checking, and build verified in CI.
- `tests/`: behavior-guarantee tests for all examples.
- `guide/`: getting started, first app, mental model, recipes.
- `.claude/skills/`: `kumiki-author` / `kumiki-debug` / `kumiki-iterate` skills.
- `design-notes/`: consolidates design rationale and benchmarks (learning cost v1–v4, token efficiency vs. React).
- **Static method existence check (E0801)**: when `obj.method(...)` calls a method not implemented in the runtime (a typo, misuse like `Option.to-result`, or an unimplemented spec method), it is detected at the `check` stage. The implementation set is the single source of truth in `@kumiki/compiler`'s `KNOWN_METHODS` (kept in sync with codegen). It catches `.to-result`-class bugs — previously caught only at the smoke layer — at layer 1.
- **`List.fold` / `Int` / `Float.parse` fixes** (found while demoing the iterate loop): implemented `fold`'s codegen + runtime, and fixed `Int.parse`/`Float.parse` to do numeric conversion (previously they returned strings, breaking sums and the like). Examples: `examples/features/24-fold.kumiki`, `examples/apps/06-expenses/`.

### Changed

- Changed the one-reducer-one-write rule from route-name granularity to **path-shape (lvalue shape) granularity**. `tasks[id].status` and `tasks[id].updatedAt` can now coexist.
- Runtime: guard so that delayed effect results after dispose don't touch the DOM (resolves `NotFoundError` caused by in-flight fetches).
- AST: renamed the fields of `IfStmt` / `IfExpr` / `TileIf` from `then`/`else` → `consequent`/`alternate`.

### Notes

- experimental v0.1. The language, runtime, and tools may change without notice.
