# Strand Reference Implementation — Phase 1

English · [日本語](./reference-phase1-status.ja.md)

Phase 1 PoC: with 01-counter.strand as input, **lexer → parser → typecheck → codegen → runtime** runs in series, and the Counter SPA works in the browser.

## Status

| AC | Status |
|---|---|
| AC-Lexer (9) | pass |
| AC-Parser (5) | pass |
| AC-Typecheck (7) | pass |
| AC-Codegen (1) | pass |
| AC-Runtime (5) | pass |
| AC-CLI (1) | pass |
| **Total 28 / 28** | pass |
| Manual browser check | server started, visual inspection on the user side |

## Directory

```
reference/
├── package.json
├── tsconfig.json
├── biome.json
├── vite.config.ts
├── scripts/
│   └── serve.mjs              static file server
├── src/
│   ├── compiler/
│   │   ├── ast.ts             Phase 1 AST types
│   │   ├── lexer.ts           lexical analysis
│   │   ├── parser.ts          hand-written recursive-descent parser
│   │   ├── typecheck.ts       name resolution + type checking
│   │   ├── codegen.ts         AST → JS
│   │   └── compile.ts         lex→parse→check→codegen
│   ├── runtime/
│   │   └── index.ts           mount / DOM rendering / dispatch
│   └── cli/
│       ├── strand.ts          strand build command
│       └── strip-ts.ts        strip the runtime's TS types
└── test/
    ├── lexer.test.ts
    ├── parser.test.ts
    ├── typecheck.test.ts
    ├── codegen.test.ts
    ├── runtime.test.ts
    └── cli.test.ts
```

## Usage

### Tests

```bash
pnpm install
pnpm test              # all 28
pnpm test:watch
pnpm lint
```

### Building Counter

```bash
pnpm strand build ../docs/examples/01-counter.strand ../examples-build/counter
# → index.html, app.js, runtime.js are emitted to examples-build/counter/
```

### Verifying Operation in the Browser

```bash
# in the reference/ directory:
node scripts/serve.mjs ../examples-build/counter 5174
# → open http://localhost:5174 in the browser
```

Expected behavior:

1. `Count: 0` and the 3 buttons `[-]` `[reset]` `[+]` are displayed
2. each press of `+` increments by 1
3. pressing `+` at 999 stays at 999 (the refinement `between(0, 999)`)
4. pressing `-` at 0 stays at 0
5. `reset` returns to 0

## Known Limitations (Phase 1 Scope)

- effect / fn / match / for / when / if-then-else expressions / Map / Set / List unsupported
- routing is in the AppDef but is not resolved at runtime (it only renders the `/` tile)
- theme unsupported (simple inline CSS only)
- a11y checking unsupported
- AI editing API unsupported
- episode log unsupported

These are added incrementally in Phase 2.

## Design Decisions

Points intentionally kept small in Phase 1:

| Decision | Reason |
|---|---|
| no signal graph, full re-render on every click | a naive implementation without DOM diff, prioritizing operation |
| direct JS output without going through an IR | sufficient for Phase 1; insert an IR in Phase 2 |
| `strand build` only (dev / check separately) | focus on the core experience |
| test the runtime with hand-written AppShape on Vitest jsdom | codegen→runtime integration via CLI smoke and manually |
| do not use `new Function` | following the security warning, also avoiding tmp files / dynamic import, unifying on isolated tests |
