# 01 — Counter

English · [日本語](./README.ja.md)

The smallest Strand app. With this alone, you get one full cycle of "state, update, render."

## What you'll learn

- Declaring state with `slot`
- Writing `on=` (event) → `do=` (state update) in a `reducer`
- Building UI with `tile` and wiring a `button` click to a reducer
- Tying everything together with `app`

## Run

```sh
pnpm --filter @strand/cli exec tsx src/strand.ts build examples/apps/01-counter/app.strand ./out
```

Related specs: [language](../../../spec/language.md)
