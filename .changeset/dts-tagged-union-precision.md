---
"@kumikijs/compiler": patch
---

fix(dts): `generateDts` emits precise tagged unions for Option / Result / unions

`generateDts` now maps `Option(T)`, `Result(T, E)`, and user `type` unions to
their actual runtime representation — the tagged `{ _tag: "Some"; _0: T }` /
`{ _tag: "Ok"; _0: T } | { _tag: "Err"; _0: E }` / `{ _tag: "Name"; _0: … }`
forms — instead of `T | null` / `unknown`. Variant payloads are positional
(`_0`, `_1`, …) and nest correctly through `List` / `Option` so generated
provider types match the values the runtime produces and consumes.
