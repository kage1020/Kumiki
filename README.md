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

Cross-vendor measurements confirm that LLMs can write Kumiki apps up to a scale of 1300 lines from the specification alone. Token efficiency is also high compared to React.

## Repository layout

| Directory | Role |
|---|---|
| [`docs/`](./docs/) | Documentation site (VitePress). `spec/` (**normative spec**) · `guide/` (tutorials). Japanese pages under `ja/`. |
| [`packages/`](./packages/) | Implementation and supporting code. `compiler` / `runtime` / `cli` / `mcp` / `syntax`, plus `examples` / `tests` / `benchmarks` |

## Quick Start

```sh
pnpm install
pnpm build          # build all packages
pnpm test           # all tests

# Check and build a Kumiki program (run from the repo root)
pnpm kumiki check packages/examples/apps/01-counter/app.kumiki
pnpm kumiki build packages/examples/apps/01-counter/app.kumiki ./out
```

If you're new, go to [docs/guide/getting-started.md](./docs/guide/getting-started.md) → [docs/guide/your-first-app.md](./docs/guide/your-first-app.md).

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
