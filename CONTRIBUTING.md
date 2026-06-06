# Contributing to Kumiki

English · [日本語](./CONTRIBUTING.ja.md)

Kumiki is experimental OSS, and its operating policy is somewhat unusual. Please read this before getting your hands dirty.

## Core policy: answer questions and bugs with examples and tests

The goal of this repository is that "**looking at it resolves your question**". Therefore:

- **When a question comes in** → add the relevant minimal example to `packages/examples/features/` (if it doesn't exist).
- **When a bug report comes in** → add a minimal reproduction to `packages/examples/`, add a regression test to `packages/tests/`, and then fix it.
- **When you add a new feature** → update `docs/spec/` and add a working example to `packages/examples/`.

The spec (`docs/spec/`) is authoritative, and the implementation (`packages/`) follows it. When you find a discrepancy, record the design decision of which to fix in the PR description.

## Development flow (TDD)

1. **Design** — settle the requirements and approach
2. **Acceptance Criteria (AC)** — write out test cases as AC (no code yet)
3. **Test implementation** — write test code from the AC
4. **Implementation** — write production code to pass the tests
5. **Iterate** — until all tests are green

Don't start straight from implementation.

## Setup

```sh
pnpm install
pnpm build
pnpm test
```

Tooling: the package manager is **pnpm**, the build is **Turborepo** + **tsc/esbuild**, the test runner is **Vitest**, and the linter/formatter is **Biome**.

## Pre-submission check

```sh
pnpm exec turbo run typecheck test lint build
```

Everything must be green. In particular:

- **Every new example must pass check + build + smoke** (`packages/tests/` verifies this automatically). `check`/`build` only guarantee syntax, types, and codegen. Whether it **actually mounts and survives interaction** is verified by `kumiki smoke <file>` (= the runtime smoke in `packages/tests/`). "Compiles but errors / renders nothing when run" bugs are caught here.
- **Inline lint suppression (`@biome-ignore`, etc.) is forbidden**. If you want to add one, fix the design instead.
- **Don't hardcode dependency versions**. Install the latest with `pnpm add`, and put shared versions in the catalog of `pnpm-workspace.yaml`.

## Git

- Don't commit directly to `main` / `dev`. Create a feature branch.
- Commit frequently.

## Where things go, by directory

| Change | Location |
|---|---|
| Language/runtime spec | `docs/spec/` |
| Usage / tutorials | `docs/guide/` |
| Working examples | `packages/examples/features/` or `packages/examples/apps/` |
| Implementation | `packages/*/src/` |
| Tests | per-package `test/`, cross-cutting in `packages/tests/` |
