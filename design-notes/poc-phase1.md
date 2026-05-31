# PoC Phase 1 — Specification of a Working Counter Implementation

English · [日本語](./poc-phase1.ja.md)

## Goal

Running `strand build` with `examples/apps/01-counter/app.strand` as input builds a single SPA that, when opened in the browser, has working `+` / `−` / `reset` buttons.

The flow for a human editor:

```bash
pnpm install
pnpm build
pnpm --filter @strand/cli exec tsx src/strand.ts build examples/apps/01-counter/app.strand out/counter
node benchmarks/scripts/serve.mjs out/counter 5173
```

→ In the browser, "Count: 0" + 3 buttons. `+` increments by 1, `reset` sets to 0, `−` decrements (the refinement rejects values below 0).

## Support Scope (Phase 1)

| Covered | Details |
|---|---|
| `type` | `Int` / `Text` / `Bool` / `Unit` / `nominal T where refinement` |
| Predicates | `between(A,B)` only |
| `slot` | The simple form `slot name : T = init` |
| `reducer` | `on=ui.click(TileName)` and `do=` with one or more `slot := expr` |
| `tile` | The 5 built-in elements `column`, `row`, `heading`, `text`, `button` |
| Expressions | Literals, identifiers, `+`/`-`, `==`/`!=`, string concatenation |
| `app` | `caps=[] routes={"/" -> App, "/404" -> App} init=[]` |
| Runtime | DOM rendering, event handlers, dirty propagation and re-rendering on slot change |

**Not handled in Phase 1**: `effect`, `fn`, `match`, `for`, `when`, `if-then-else` expressions, `Map`/`Set`/`List`, other refinement predicates, route resolution, themes, a11y, the AI editing API, the episode log.

## Directory Layout

```
packages/
├── compiler/
│   └── src/
│       ├── ast.ts            ← AST types
│       ├── lexer.ts          ← tokenizer
│       ├── parser.ts         ← syntax analysis
│       ├── typecheck.ts      ← name resolution + type checking
│       ├── codegen.ts        ← AST → JS code
│       └── compile.ts        ← lex→parse→check→codegen integration
├── runtime/
│   └── src/
│       └── index.ts          ← runtime entry (mount), slot store + dirty tracking, virtual tile → DOM reflection
└── cli/
    └── src/
        └── strand.ts         ← strand build command
```

## Acceptance Criteria (AC)

Locked down first with TDD.

### AC-Lexer

| Input | Expected token sequence |
|---|---|
| `slot count : N = 0` | `[KW(slot), IDENT(count), OP(:), IDENT(N), OP(=), NUM(0)]` |
| `# hello\nx` | `[IDENT(x)]` (comments are ignored) |
| `"hi" + "world"` | `[STR(hi), OP(+), STR(world)]` |
| `nominal Int where between(0, 999)` | `[KW(nominal), IDENT(Int), KW(where), IDENT(between), OP("("), NUM(0), OP(","), NUM(999), OP(")")]` |
| `do= count := count + 1` | `[KW(do), OP(=), IDENT(count), OP(:=), IDENT(count), OP(+), NUM(1)]` |
| An identifier longer than 32 characters | Error: identifier too long |

### AC-Parser

Feeding all of `examples/apps/01-counter/app.strand`, the following AST node counts:

- TypeDef: 1 (N)
- SlotDef: 1 (count)
- ReducerDef: 3 (inc / dec / reset)
- TileDef: 4 (IncBtn / DecBtn / ResetBtn / App)
- AppDef: 1 (Counter)

For each reducer, `on.kind === "ui.click"` with the selector being a tile-ref, and `do[0]` being a SlotAssign.

### AC-Typecheck

- The right-hand side of `count := count + 1` conforms to type `N` (Int with a refinement)
- All tile references in `column(heading("Count: " + count), row(DecBtn, ResetBtn, IncBtn))` resolve
- `App` in `"/" -> App` of `app.routes` is a defined tile
- Writing an undefined `usres` returns E0103
- Writing an undefined `FooBtn` in a tile body returns E0105
- Writing the same slot twice within one reducer, like `count := count + 1; count := 0`, gives E0601

### AC-Codegen + Runtime

When the generated JS is mounted onto the DOM in the browser:

- The initial display renders "Count: 0" and 3 buttons
- Clicking `+` updates to "Count: 1"
- Clicking `+` 100 times gives "Count: 100"
- Clicking `+` at 999 stays at 999 (refinement: between(0,999))
- Clicking `−` at 0 stays at 0
- `reset` returns to 0
- No side effects are emitted (effects are unsupported in Phase 1)

### AC-CLI

```bash
pnpm --filter @strand/cli exec tsx src/strand.ts build examples/apps/01-counter/app.strand out/counter
```

- Exit code 0
- `out/counter/index.html` and `app.js` are created
- Opening the HTML in the browser works as in AC-Runtime

### AC-E2E

In `test/e2e.test.ts`:
- Read `examples/apps/01-counter/app.strand` and build
- eval / dynamic-import the output JS
- Mount on jsdom
- Dispatch a `+` event → the DOM text changes to "Count: 1"

## Implementation Order (TDD)

| step | Content | Test |
|---|---|---|
| 1 | Project setup | `pnpm test` succeeds with 0 cases |
| 2 | AST types + Lexer | all examples in `lexer.test.ts` |
| 3 | Parser | `parser.test.ts` parses `examples/apps/01-counter/app.strand` successfully |
| 4 | Typecheck | `typecheck.test.ts` covers each normal/abnormal case of AC-Typecheck |
| 5 | Codegen | `codegen.test.ts` checks the generated JS has a structure close to the expected form |
| 6 | Runtime | `runtime.test.ts` confirms mounting and updating on jsdom |
| 7 | CLI | `cli.test.ts` checks the build command creates index.html |
| 8 | E2E + manual browser check | Screenshots |

## Design Decisions (PoC Scope)

| Decision | Reason |
|---|---|
| Make the PoC a single package | A monorepo is for the next phase. Phase 1 prioritizes speed |
| Hand-written recursive-descent parser | Avoids adding dependencies (acorn/peggy, etc.) and runs on Strand's syntax alone |
| Runtime is "re-render all tiles + no DOM diff" | Phase 1 prioritizes operation over performance. After the initial render, dirty detection → regenerate only the affected tile |
| Omit the IR, generate JS code directly | Phase 1 short-circuits without going through an IR. Phase 2 inserts an IR |
| The dev server serves the build output (`out/`) directly | strand dev is for Phase 2 |
| The signal graph is also not implemented in Phase 1 | A naive implementation that re-renders the affected tile whenever any slot changes |

## Definition of Done

- All of the above AC pass
- `out/counter/index.html` can be opened in the browser and manually verified
- Screenshots are kept
- Known constraints are documented in the README
