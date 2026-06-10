---
"@kumikijs/runtime": minor
"@kumikijs/compiler": minor
"@kumikijs/cli": minor
---

Per-app dead-code elimination for `kumiki build` (#71). The runtime is now
composed of granular feature modules — `core` (mount/dispatch/theme/render
seam), `stdlib`, `testkit` (the reducer/property/tile test harness),
`router`, `effects-{storage,http,toast}`, and seven `tiles-*` renderer
families — published as `@kumikijs/runtime/modules/*` (minified ESM).
Codegen tracks which built-in tiles, effects, and routing features an app
uses and, in the new `runtimeModulesDir` mode, imports only those modules,
mounting through the new `mountCore` (the classic `mount`, merged
`_stdlib`, `builtinEffects`, and the `./bundle` / `./bundle.min` artifacts
are unchanged). `kumiki build` ships `runtime/` with exactly that pruned
set instead of a monolithic `runtime.js`: the counter example drops from
50KB/15.2KB gzip to ~27KB/~9KB gzip and carries no router, table/overlay
tile, effect-handler, or test-harness code. The router ships only when the
app can actually navigate (nav caps, `navigate*` emits, `link` /
`route-outlet`, redirects, or routes beyond the `"/"` + `"/404"`
boilerplate) — a static single-route app never reads the URL, so a deep
link to an unknown path renders the root tile rather than the 404 tile.
