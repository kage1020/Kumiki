---
"@kumikijs/runtime": minor
---

feat: no-silent-failure contract for unhandled effect errors (v0.5 M2, #37)

An effect `err` result that no `.err` reducer consumes is now surfaced via
`console.error` (`[kumiki] effect "<name>" returned an error with no .err
reducer: …`) instead of being dropped silently — so the verification tiers
(`smoke` / `runScenario`, which capture `console.error`) flag it, consistent
with the v0.3 live-panic model. This fixes the storage-unavailable case (sandbox
preview / private mode) that previously looked like the app did nothing.

The default contract is `err` + a surfaced report; a program opts into handling
(or deliberately ignoring) the error by wiring an `.err` reducer (even an empty
one). An in-memory storage fallback is explicitly not the silent default.
Backward-compatible (additive surfacing; defaults unchanged).
