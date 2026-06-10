# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

Kumiki is an **AI-first web framework language** — a declarative DSL plus compiler/runtime/tooling, optimized for LLMs to write/edit/reason about rather than for humans to read. A `.kumiki` source is a set of independent definitions across **7 layers** (type / slot / effect / reducer / tile / fn / app). The repo is a pnpm + Turborepo monorepo; `docs/spec/` is the **normative spec** and `packages/*` implements it.

For authoring, debugging, or iterating on `.kumiki` programs themselves, prefer the dedicated skills: `kumiki-author`, `kumiki-debug`, `kumiki-iterate`. This file is about working on the repo's TypeScript implementation.

## Commands

All workspace tasks run through Turborepo (`turbo run …`); `^build` is a dependency of `check`/`test`/`typecheck`, so they build upstream packages first.

```sh
pnpm install
pnpm build            # build all packages (tsdown / tsc)
pnpm test             # all tests (Vitest)
pnpm check            # turbo check across packages
pnpm typecheck        # tsc --noEmit across packages
pnpm lint             # biome check .
pnpm format           # biome format --write .

# Pre-submission gate — everything must be green:
pnpm exec turbo run typecheck test lint build
```

Single package / single test (Vitest):

```sh
pnpm --filter @kumikijs/compiler test
pnpm --filter @kumikijs/compiler exec vitest run src/parser.test.ts
pnpm --filter @kumikijs/compiler exec vitest run -t "test name substring"
```

Driving the Kumiki CLI from the repo root (runs the TS entry via tsx, no build needed):

```sh
pnpm kumiki check packages/examples/apps/01-counter/app.kumiki
pnpm kumiki build packages/examples/apps/01-counter/app.kumiki ./out
pnpm kumiki smoke <file>            # mount + interact in happy-dom (catches "compiles but renders nothing")
pnpm kumiki run <file> <scenario.json>
```

Full CLI verbs: `build / list / view / refs / check / smoke / run / test / fix` (see `packages/cli/src/kumiki.ts`).

> **Environment note**: the shell is PowerShell on Windows. The user has a deny rule on running PowerShell cmdlets through the Bash tool — use the dedicated file/search tools, or invoke `pnpm`/`git` directly.

## Architecture

**Packages** (`packages/*`, published as `@kumikijs/*`):

| Package | Role |
|---|---|
| `@kumikijs/compiler` | The pipeline: `lex → parse → check → codegen` (`src/compile.ts`). Pure/browser-safe; Node-only helpers (capability manifest, runtime bundle reader) are isolated in `src/node.ts` and exported as `@kumikijs/compiler/node`. |
| `@kumikijs/runtime` | DOM runtime — signal graph, mount, effect dispatch. Compiled apps import from it (or it's inlined via `bundle: true`). |
| `@kumikijs/cli` | `kumiki` command — build/check + the AI-editing verbs (list/view/add/replace/remove/rename/fix). |
| `@kumikijs/mcp` | MCP server exposing the compiler, AI-editing, and spec search as MCP tools. |
| `@kumikijs/syntax` | TextMate grammar for `.kumiki` (Shiki / VitePress / VS Code). |
| `@kumikijs/vite` | Vite plugin — `import App from "./app.kumiki"` in any Vite/Next project (compiles via `exportApp`; optional typed `.gen.ts` provider helpers). |
| `kumiki` | Thin convenience CLI wrapper over `@kumikijs/cli`. |
| `@kumikijs/e2e` (private) | Real-browser tier (Playwright/Chromium). |
| `@kumikijs/tests` (private) | Cross-cutting tests: every example must parse + typecheck + build. |
| `packages/examples`, `packages/benchmarks` | Working apps/features and learning-cost/token benchmarks. |

**The compiler keeps Node imports out of the core.** Anything touching the filesystem belongs in `src/node.ts`, injected into `compile()` (e.g. `readRuntimeBundle`) so the compiler runs unchanged in the browser. Preserve this boundary.

**3-tier verification** — `check`/`build` only guarantee syntax, types, and codegen. Whether an app actually mounts and survives interaction is a separate guarantee:
1. **check / build** — lexer, parser, typechecker, codegen.
2. **smoke** (`kumiki smoke`, runtime in happy-dom) — catches "compiles but renders nothing / throws on interaction".
3. **e2e** (`@kumikijs/e2e`, Chromium) — CSS layout, real focus, rendering bugs a headless DOM can't see.

## Operating model (read before making changes)

The repo's policy is "**looking at it resolves every question**" — questions and bugs are answered by adding examples and tests, not prose. From `CONTRIBUTING.md`:

- **New feature** → update `docs/spec/` (authoritative) **and** add a working example to `packages/examples/`.
- **Bug** → add a minimal repro to `packages/examples/`, a regression test to `packages/tests/`, then fix.
- **Spec ⇆ implementation discrepancy** → the spec wins; record which side to fix in the PR description.
- **Every new example must pass check + build + smoke** — `@kumikijs/tests` enforces this in CI, so a broken example fails the build.

Follow **TDD (t_wada style)**: Design → Acceptance Criteria (as AC, no code) → test code → implementation → iterate. Don't jump straight to implementation.

## Conventions

- **Package manager is pnpm**; build is Turborepo + tsdown/tsc; tests are Vitest; lint/format is Biome (2-space, width 100). Run `pnpm format` before finishing.
- **Never hardcode dependency versions.** Install latest via `pnpm add`; put shared versions in the `catalog:` block of `pnpm-workspace.yaml` and reference them as `"catalog:"`.
- **Inline lint suppression is forbidden** (`@biome-ignore`, `@ts-ignore`, etc.). If you reach for one, the design is wrong — fix the root cause. Biome enables `useImportType`, `useNodejsImportProtocol`, and warns on `noExplicitAny`.
- **Publishing**: packages dev-resolve `exports` to `src/*.ts`, and `publishConfig.exports` switches to built `dist/*.js` at publish. tsdown builds the dist; Changesets + GitHub Actions handle versioning/release. Don't point exports at dist for local dev.
- **Git**: never commit to `main`/`dev`; branch first and commit frequently.
