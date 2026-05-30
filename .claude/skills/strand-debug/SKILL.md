---
name: strand-debug
description: Diagnose and fix Strand compiler errors. Use when `strand check`/`build` reports a diagnostic (E0001..E07xx) or a parse error, or when a built Strand app misbehaves in the browser. Covers the error catalog, common root causes, and the auto-fix tool.
---

# Debugging Strand

## First: get the diagnostic

```sh
pnpm --filter @strand/cli exec tsx src/strand.ts check <file>
```

Or `strand_check` via `@strand/mcp`. Each diagnostic has a stable `code` (E0xxx) documented in `spec/errors.md`. Read that entry first — it states the rule and the fix.

## Error code map (see spec/errors.md for detail)

| code | meaning | usual fix |
|---|---|---|
| `E0001` | `app.routes` missing `/404` | add `"/404" -> NotFound` |
| `E0102` | undefined reducer in a handler | fix the reducer name; try `strand_fix` |
| `E0103` | undefined name / slot | declare it, or fix the spelling |
| `E0104` | undefined effect in `emit` | declare the effect or fix the name |
| `E0105` | undefined tile (incl. route target) | declare the tile or fix the name |
| `E0201` | handler arg/prop is not a reducer | point it at a `reducer` |
| `E0301` | effect needs a capability not in `app.caps` | add the cap to `caps = [...]` |
| `E0305` | a `fn` reads a slot | pass the value as an argument |
| `E0601` | a slot path-shape is written twice in one reducer | chain the writes into one assignment |
| `E0701`–`E0703` | a11y: button/image/link missing text/alt/aria | add visible text or `aria-label`/`alt` |
| `E0801` | `obj.method(...)` calls a method the runtime doesn't implement (typo, or unimplemented/wrong-type method like `Option.to-result`) | fix the name or rewrite with an implemented op (`match`, `fold`, …); see `KNOWN_METHODS` / spec/stdlib.md |
| `E0000` | parse error (from the lexer/parser) | check the position; look for a missing `)` / wrong keyword |

## Auto-fix

For name-resolution errors (E0102–E0105), the compiler can suggest the closest existing name:

```sh
pnpm --filter @strand/cli exec tsx src/strand.ts fix <file>          # show planned fixes
pnpm --filter @strand/cli exec tsx src/strand.ts fix <file> --apply  # apply them
```

Or `strand_fix` via `@strand/mcp`.

## "It checks but misbehaves at runtime"

`check`/`build` prove parse + typecheck + codegen; they do NOT prove the app runs. First reach for the runtime smoke test, which mounts the app in a headless DOM and drives its UI:

```sh
pnpm --filter @strand/cli exec tsx src/strand.ts smoke <file>
```

Or `strand_smoke` via `@strand/mcp`. It reports the failing phase and the interaction that triggered it (e.g. `[interaction] (...).to_result is not a function (on input input[0])`) — catching throws, empty renders, and unhandled rejections that compilation misses.

There are three verification layers; each catches what the previous cannot:

1. **`check` / `build`** — syntax, types, codegen.
2. **`smoke`** — *does it run?* mount + auto-exercise; catches runtime throws / empty render. Generic, no per-app knowledge.
3. **example-specific assertions** (in `tests/` or `packages/cli/test/`) — *is the result correct?* the only layer that catches wrong-but-non-throwing behavior (e.g. a select that always yields the last option). Smoke cannot judge correctness, only liveness.

When you find a runtime bug: add a minimal reproducing `examples/features/*.strand` (CI smoke-tests it automatically), then fix. Most runtime bugs are a wrong method dispatch (List vs Map vs Option), a method the runtime doesn't implement, a missing `key=` on a `for`-rendered tile, or a bind-path issue. Runtime fixes live in `packages/runtime/src/index.ts`; codegen fixes in `packages/compiler/src/codegen.ts`. Keep `pnpm exec turbo run test` green.
