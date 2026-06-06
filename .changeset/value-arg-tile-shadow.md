---
"@kumikijs/compiler": patch
---

fix: parse builtin-tile-named user fns as values in value-arg position

A user `fn` whose name shadows a builtin tile (`label`, `text`, `markdown`,
`link`, `image`, `icon`) was mis-parsed as a nested tile when used in a
value-arg position such as `heading(label(light))`. Codegen then emitted
`_s.show(undefined)`, rendering an always-empty heading (surfaced by
`03-union-and-match` in the playground). Value-arg positions now always parse
their argument as an expression.
