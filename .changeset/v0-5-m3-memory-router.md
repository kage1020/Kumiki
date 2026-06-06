---
"@kumikijs/runtime": minor
"@kumikijs/compiler": minor
---

feat: virtual / memory router mode for embedded contexts (v0.5 M3, #36)

`mount(app, el, { router: "memory", initialPath?: "/" })` resolves the initial
route from `initialPath` (not the ambient `location`) and routes `navigate` /
link clicks / `navigate-back` through an in-memory path with no `history.*` —
so path-based routing works inside the playground `<iframe srcdoc sandbox>` and
any embedded host (Web Component, embed) that owns the top-level URL, where the
ambient origin is opaque and `history.pushState` throws.

`router: "history"` stays the default (apps at a real origin are unaffected).
The auto-mounting bundle spreads `globalThis.__kumikiMount` into mount options
(compiler), and `defineKumikiElement(tag, app, { router, initialPath })`
forwards the option to the Web Component. `runScenario` gained a
`{ router, initialPath }` option. Backward-compatible (additive; defaults
unchanged).
