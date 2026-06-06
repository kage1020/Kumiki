---
"@kumikijs/compiler": minor
"@kumikijs/runtime": minor
---

feat: multiple independent instances via a `createApp()` factory

A compiled app previously bound its render closures to one module-level live
state, so mounting the same app twice (or two Web Component instances) shared
state. Codegen now wraps the per-instance pieces (slots, live, reducers, routes,
effects, tiles) in a `createApp()` factory whose closures bind to that call's own
`live`. Each `createApp()` returns a fully independent `AppShape`; no runtime
change is needed.

- Compiled modules expose `createApp` (and `export { createApp }` under
  `exportApp` / the Vite plugin); the default export remains a single shared
  instance for back-compat.
- `defineKumikiElement(tag, appOrFactory, …)` accepts a factory — pass the
  module's `createApp` so each `<tag>` element gets its own state; passing an
  `AppShape` keeps the shared single-instance behavior.
- `@kumikijs/vite/client` ambient types now declare the `createApp` export.
