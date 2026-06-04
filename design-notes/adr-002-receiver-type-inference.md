# ADR 002 — Receiver type inference for method-shortcut dispatch

English · [日本語](./adr-002-receiver-type-inference.ja.md)

**Status:** Accepted (v0.3 M2) · **Supersedes:** none · **Relates to:** [#23](https://github.com/kage1020/Kumiki/issues/23), [#7](https://github.com/kage1020/Kumiki/issues/7), [#5](https://github.com/kage1020/Kumiki/issues/5), [roadmap-v0.3](./roadmap-v0.3.md)

## Context

Kumiki's checker is **type-light**: name resolution + a11y + capabilities, with **no type inference**. So `codegen.ts` `jsOfExpr`'s `FieldAccess` case dispatches `recv.m` (the parenthesis-free method shortcut, spec/stdlib.md §2.2.3) by matching `m` against a hardcoded list of method names, **unconditionally and before** the `(base)[field]` field fallthrough. Consequences (issue #23):

- **Shadowing.** `node.head` on a record `{head, tail}` lowers to `_s.listHead(node)` → `None` (silent wrong value); `r.abs` on `{abs, rel}` → `NaN`; `resp.get-err` on a record → throws. There is no escape hatch — the parenthesized form `node.head()` is intercepted too.
- **No diagnostic.** The `FieldAccess` path is never validated, so an unknown `recv.bogus` compiles to `undefined`. The "FieldAccess / methodCallJs / KNOWN_METHODS kept in sync" invariant is asymmetric (some no-paren shortcuts — `is-ok`, `is-err`, `values`, `entries`, `lower`, `upper`, `sort`, `ms` — are missing from `KNOWN_METHODS`, so their `.m()` form trips E0801 even though `.m` works).

The fix requires the **static type of the receiver**, which the checker does not compute today.

## Decision

### 1. Architecture — infer in typecheck, annotate the AST, consume in codegen

`compile()` passes the **same `Program` object** to `check()` then `codegen()`. So the checker performs the (minimal) inference, **annotates each `FieldAccess` node** with a resolved dispatch decision, and codegen reads it. This keeps inference in **one pass**, makes the codegen change tiny, and removes any risk of the two passes building divergent type environments.

The annotation is one optional field on the `FieldAccess` AST node:

```ts
accessKind?: "field" | "shortcut"
```

- `"field"` — the receiver is a record (or resolves to one) that **has** a field named `field`. Codegen emits `(base)[field]` directly, skipping the method-shortcut checks. (Fixes the shadow.)
- `"shortcut"` or **absent** — codegen keeps its current name-based dispatch. Absent covers codegen invoked without `check()` (e.g. focused codegen unit tests) — back-compat.

### 2. Inference scope — sound where it speaks, silent where it doesn't

A new `inferType(expr, env): TypeExpr | null` (in `typecheck.ts`). `null` means **undecidable / dynamic** — the inference never guesses. Type sources for the environment:

- **slots** — `SlotDef.type`
- **fn params** — `FnDef.params[].type`
- **tile `in`** — bound to `$1` inside the tile body
- **`let` bindings** — inferred from the RHS

Constructs `inferType` resolves: literals (`Num`→Int/Float, `Str`→Text, `Bool`→Bool, `RecordLit`→a structural record type, `ListLit`/`MapLit`), `Ref` (env lookup), `FieldAccess` (record field type), `.get` (unwrap `Option(T)`/`Result(T,E)` → `T`), `Index` (List→elem, Map→value). Everything else (most method calls, `match`/`if` whose branches disagree, reducer payloads `$event`/`$el`) returns `null`. A `resolveType` helper unwraps `TypeRef` aliases (via `sym.types`) and `TypeNominal`/`TypeRefinement` to their inner type.

This deliberately does **not** type reducer payload binds or `match` binds — those fall back to dynamic. They are not the shadowing-prone receivers (which are named record-typed values), and typing them fully would require event-shape and union-narrowing inference out of scope here.

### 3. Dispatch rule

For `recv.field` with `T = resolveType(inferType(recv))`:

| `T` | `field` | Decision |
|---|---|---|
| record | is a field of the record | **field** |
| record | a universal method (`show`) | shortcut |
| record | otherwise | **diagnostic E0108** |
| known stdlib type (List/Map/Set/Option/Result/Text/Int/Float/Bool/Time) | a known member | shortcut |
| known stdlib type | otherwise | **diagnostic E0108** |
| `null` / unresolved | anything | shortcut (no diagnostic) |

"Known member" = the union of `KNOWN_METHODS` and the no-paren `FieldAccess` shortcut names, exported from codegen as a single `KNOWN_MEMBERS` set. This is a **flat** set, not per-type: M2 catches a *totally unknown* member (`recv.bogus`) but does **not** reject a valid-method-on-the-wrong-type (`list.get-err`) — that needs per-type method tables and is an explicit non-goal (it would also risk false positives while inference is partial).

### 4. New error code — E0108 `undef-member`

In the `E01xx` name-resolution band (next free after E0107 undef-motion). Raised when the receiver type is **known** and `field` is neither a member of that type (record field / known method) nor the universal `show`. When the receiver type is unresolved, **no** diagnostic is raised (consistent with the dynamic→shortcut fallback — we never flag what we can't type).

### 5. Symmetry fix

The no-paren `FieldAccess` shortcut names missing from `KNOWN_METHODS` (`is-ok`, `is-err`, `values`, `entries`, `lower`, `upper`, `sort`, `ms`) are added, so `recv.m` and `recv.m()` agree for every shortcut. A test enforces `FIELD_ACCESS_SHORTCUTS ⊆ KNOWN_METHODS` so a future shortcut can't reintroduce the asymmetry.

## Consequences

**Positive.** The silent-wrong-value class from #23/#7/#5 is closed for typed receivers; record fields named like methods read correctly; unknown members on typed receivers become a compile error instead of `undefined`; the shortcut sets are symmetric.

**Negative / accepted.**
- The inference is **partial** by design. A record reached only through an untyped path (a reducer payload, a `match` bind) still falls back to shortcut dispatch — the shadow can still occur there, but those receivers are rare and the fallback is the pre-M2 behavior (no regression). Documented as a known boundary.
- E0108 is a **tightening**: a program that previously compiled `recv.bogus` to `undefined` now fails to compile. This is the intended correctness gain (pre-1.0, minor bump) and is called out in the CHANGELOG.
- No general type checker. M2 adds member-resolution only — no type-mismatch diagnostics, no HM/bidirectional inference (roadmap non-goal).

## Alternatives considered

- **Infer in codegen (shared `inferType`, codegen builds its own type env).** Rejected: codegen's `EvalCtx` tracks bind *names* only; threading bind *types* through every codegen scope (let / match / lambda / tile `$1`) duplicates the environment and risks divergence from the checker. Annotating the shared AST is strictly less code and single-source-of-truth.
- **Reserve the shortcut names from record/map field names** (forbid a field literally named `head`). Rejected: punishes the data model for a dispatch limitation; AI-generated records routinely use names like `head`/`last`/`size`.
- **Require parentheses to disambiguate** (`node.("head")` or similar). Rejected: adds syntax for a problem the type already resolves; contradicts the paren-free shortcut the spec recommends.
