---
"@kumikijs/runtime": minor
"@kumikijs/cli": patch
---

Ship a minified runtime to built apps. `@kumikijs/runtime` now emits two
artifacts: `./bundle` (unminified — still what codegen inlines for
smoke/run/test and the playground, where readable traces matter and the
inliner relies on stable top-level names) and the new `./bundle.min`
(minified ESM). `kumiki build` writes `bundle.min` as the app's
`runtime.js`, cutting it from 90KB/24.8KB gzip to 50KB/15.2KB gzip. The
package also declares `sideEffects: false`, so bundlers consuming
`@kumikijs/runtime` through `@kumikijs/vite` can tree-shake unused exports.
A new CLI test mounts the exact built artifact pair in a headless DOM to
guarantee runtime parity.
