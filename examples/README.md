# Strand Examples

English · [日本語](./README.ja.md)

This directory is a **comprehensive set of working examples** for Strand. As an operating policy, every time a question, issue, or bug report comes in, an example is added here, keeping the state where "looking at the repository resolves your question".

All examples have parsing, type checking, and build verified in CI (→ [tests/](https://github.com/kage1020/Strand/tree/main/tests)). Broken examples are not merged.

## Structure

### `features/` — per-feature minimal examples

One feature per file. It shows each element of the language with a minimal app focused on just that. A catalog for instantly answering "how do I write this syntax again?".

### `apps/` — complete apps ordered by size

From small to large. Shows how features combine in real apps.

| App | Size | Main takeaways |
|---|---|---|
| [01-counter](./apps/01-counter/) | ~22 lines | slot / reducer / tile / events |
| [02-todomvc](./apps/02-todomvc/) | ~161 lines | lists, filters, `bind`, localStorage persistence |
| [03-blog](./apps/03-blog/) | ~418 lines | routing, HTTP fetch, suspense |
| [04-issue-tracker](./apps/04-issue-tracker/) | ~726 lines | CRUD, `Map`, `Option` variants, forms, dates |
| [05-project-management](./apps/05-project-management/) | ~1255 lines | nested data, kanban, comments, tags, theme switching |

## How to run

```sh
# Type check
pnpm --filter @strand/cli exec tsx src/strand.ts check examples/apps/01-counter/app.strand

# Build (outputs index.html / app.js / runtime.js)
pnpm --filter @strand/cli exec tsx src/strand.ts build examples/apps/01-counter/app.strand ./out
```
