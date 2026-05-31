# Kumiki

English · [日本語](./README.ja.md)

**A web framework of AI, by AI, for AI.** Definitions interlock like Japanese joinery (_kumiki_) — no nails, no glue, no hidden state — so AI can write, edit, and reassemble an app in parallel without breaking it. (experimental, v0.1)

```kumiki
slot count : Int = 0

reducer inc on=ui.click(IncBtn) do= count := count + 1

tile IncBtn = button(text="+1", onClick=inc)
tile App    = column(heading("Count: " + count.show), IncBtn)

app Counter
    caps   = []
    routes = {"/" -> App, "/404" -> App}
    init   = []
```

Kumiki has none of the "optimized for human cognition" machinery like JSX, Hooks, dependency arrays, or Providers. Instead, it represents an app as a set of independent definitions across **7 layers** (type / slot / effect / reducer / tile / fn / app). Syntax overhead is small, dependencies between definitions are explicit, and AI can safely edit parts of it.

> ⚠️ **experimental**. The language, runtime, and tools may change. Production use is not intended.

## Why Kumiki

Cross-vendor measurements confirm that LLMs can write Kumiki apps up to a scale of 1300 lines from the specification alone ([design-notes/learning-cost-v4.md](./design-notes/learning-cost-v4.md)). Token efficiency is also high compared to React ([design-notes/benchmark.md](./design-notes/benchmark.md)).

## Repository layout

| Directory | Role |
|---|---|
| [`spec/`](./spec/) | **Normative spec**. language, stdlib, routing, style, forms, http, lifecycle, runtime, ai-edit, errors |
| [`guide/`](./guide/) | Tutorials and how-tos (getting started / first app / mental model / recipes) |
| [`examples/`](./examples/) | Comprehensive examples. `features/` (per-feature minimal) + `apps/` (complete apps ordered by size) |
| [`packages/`](./packages/) | Implementation. `compiler` / `runtime` / `cli` / `mcp` |
| [`tests/`](./tests/) | Cross-cutting tests. Guarantee parsing, type checking, and build for all examples |
| [`design-notes/`](./design-notes/) | Design rationale and benchmark records |

## Quick Start

```sh
pnpm install
pnpm build          # build all packages
pnpm test           # all tests

# Check and build a Kumiki program
pnpm --filter @kumiki/cli exec tsx src/kumiki.ts check examples/apps/01-counter/app.kumiki
pnpm --filter @kumiki/cli exec tsx src/kumiki.ts build examples/apps/01-counter/app.kumiki ./out
```

If you're new, go to [guide/getting-started.md](./guide/getting-started.md) → [guide/your-first-app.md](./guide/your-first-app.md).

## Packages

| Package | Contents |
|---|---|
| [`@kumiki/compiler`](./packages/compiler/) | lexer, parser, typechecker, codegen |
| [`@kumiki/runtime`](./packages/runtime/) | DOM runtime (signal graph, mount, dispatch) |
| [`@kumiki/cli`](./packages/cli/) | `kumiki` command (build / check / list / view / add / replace / remove / rename / fix) |
| [`@kumiki/mcp`](./packages/mcp/) | MCP server. Exposes the compiler, AI editing, and spec search as MCP tools |

## Operating model

This repository aims for a state where "**looking at it resolves every question**". Questions, issues, and bug reports are, as a rule, **answered by adding examples and tests**. Broken examples are rejected by CI ([tests/](./tests/)). See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

[Apache-2.0](./LICENSE). See [NOTICE](./NOTICE) for the copyright notice.
