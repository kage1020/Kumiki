# @kumikijs/runtime

## 0.2.1

### Patch Changes

- c0c1708: Fix issue #7 — implement the argument-less spec stdlib methods (`spec/stdlib.md` §2.2): `head` / `tail` / `last` / `to-list` / `get-err` / `to-option` / `parse-int` / `parse-float` / `abs` / `neg` / `to-float` / `to-int`.

  Previously the parenthesis-free form the spec recommends (`list.head`) compiled clean but evaluated to `undefined` at runtime, and the parenthesized form (`list.head()`) was rejected with E0801. Both shapes now lower to runtime helpers and are recognized in `KNOWN_METHODS`. Follow-up to #5.

  Known limitation (deferred, needs receiver type inference): dispatch is name-only, so the no-paren form shadows a record/map field of the same name (e.g. `node.head` on a record `{head, tail}`).

## 0.2.0

### Minor Changes

- 77938ee: v0.2 — close the five spec-deferred features (M1–M5)

  - **M1 `stop-timer(name)`** — explicit named-timer stop; errors E0002 / E0106.
  - **M2 `overlay` builtin** — z-axis stacking (modals / toasts / dropdowns), `align` prop, composes with `when`.
  - **M3 plugin capability registration** — `kumiki.caps.json` manifest; unlisted caps are now a compile error (E0302).
  - **M4 `test` layer + `kumiki test` runner**, and **`kumiki fix --auto-patch <test-name>`** — in-language reducer-test / tile-test with PASS/FAIL + diff output, plus deterministic repair from a failing test.
  - **M5 `motion` layer** — reusable, closed-grammar, scoped animations referenced from a tile's `motion` prop; honors `prefers-reduced-motion`; errors E0107, E0401–E0403.

  See CHANGELOG.md for the full detail.
