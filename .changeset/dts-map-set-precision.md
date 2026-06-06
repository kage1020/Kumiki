---
"@kumikijs/compiler": patch
---

fix(dts): `generateDts` emits precise runtime shapes for Map and Set

`generateDts` now maps `Set(T)` to its actual runtime representation
`Record<string, true>` (a stringified-key object) instead of `T[]`, and keeps
`Map(K, V)` as `Record<string, V>` (Map keys are stringified at runtime). With
this, every standard-library container type generated for provider authoring —
List, Map, Set, Option, Result, unions — matches the values the runtime produces
and consumes.
