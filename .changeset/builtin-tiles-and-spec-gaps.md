---
"@kumikijs/compiler": minor
"@kumikijs/runtime": minor
---

Implement every documented built-in tile and close three spec gaps (#61, #62).

**Built-in tiles (#61).** The parser/typechecker accepted the full `stdlib §2.3`
tile set while codegen implemented only a subset, so documented tiles passed
`check` but threw `Tile "<name>" not found` at `build`. The registry is now
single-sourced (`builtins.ts`, shared by parser/typecheck/codegen) and codegen +
runtime implement every tile: `code`, `video`, `list`/`list-item`,
`table`/`table-head`/`table-body`/`table-row`/`table-cell`, `modal`, `drawer`,
`tooltip`, `popover`, `toast`, `progress`, `error`, `route-outlet`, plus `slider`
and `switch` (previously in-set but unimplemented). `error(field=…)` resolves its
message from the slot's refinement predicate, honoring `theme.errors` overrides.

**Spec clarifications (#62).** Three constructs that looked legal from the spec
are now stated as rules: literal `match` patterns are unsupported (variant /
`Variant(binds)` / tuple / `_` only); `$1` in a tile requires an `in=` argument
(E0103 now hints at this); and `()` is the args/children list while `{}` is the
`key: value` props block. `link` now accepts the canonical `text=` argument
(consistent with `button`); the existing `{text: …}` prop form still compiles.
