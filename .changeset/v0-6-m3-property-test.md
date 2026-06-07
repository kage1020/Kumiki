---
"@kumikijs/compiler": minor
"@kumikijs/runtime": minor
---

v0.6 M3 (#51) — `property-test` (`spec/testing.md` §8.3). Generative testing of reducer invariants: `property-test for-all={n: T} given={…} invariant=<bool> (count=N)? (shrink=bool)?` generates `count` (default 100) cases per type (primitives, List/Map/Set/Option/Result, records, unions; refinements fold into the generator as bounds), checks the invariant, and shrinks a failing case to a minimal counterexample. `run-reducer(name)` chains apply reducers to the running state. Generation is seeded (reproducible). The runner reports `(N cases)`. `run-reducer` targets must be declared reducers (E0102).
