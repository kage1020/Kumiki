---
"@kumikijs/vite": minor
"@kumikijs/compiler": minor
---

feat: `@kumikijs/vite` build integration + typed provider helpers (build seam)

New package **`@kumikijs/vite`** — a Vite plugin so any Vite/Next/Astro project can
`import App from "./app.kumiki"`. Each source compiles to an ESM module that
default-exports the compiled `AppShape` (the importer mounts it via `mount` /
`defineKumikiElement`). Sibling `kumiki.caps.json` is resolved automatically.
Options: `bundle` (inline the runtime, default true) and `types` (emit a sibling
`<name>.kumiki.gen.ts` of typed `Slots`/`Providers` helpers). Ambient import
typing via `@kumikijs/vite/client`.

Compiler additions backing it:

- `codegen` / `compile` gain `exportApp` — emit `export default App;` instead of
  auto-mounting to `#root` (module mode for importers).
- New `generateDts(program)` API — maps the `type`/`slot`/`effect` layers to a
  TypeScript declaration (typed `Slots` and per-custom-capability `Providers`),
  so host provider adapters get real input/output types. Conservative mapping
  (`unknown` fallback for shapes whose runtime representation isn't promised).
