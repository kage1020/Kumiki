# Kumiki v0.3 Roadmap

This document defines the scope, design approach, and acceptance criteria (AC) for the v0.3 milestone. It is the planning counterpart to the per-feature design that lives in `spec/` and the working examples in `examples/`. Implementation follows the repo's TDD flow: **Design → AC → tests → implementation → iterate** ([CONTRIBUTING](https://github.com/kage1020/Kumiki/blob/main/CONTRIBUTING.md)).

## Goals

v0.2 closed the five gaps the spec marked **"planned for v0.2"** (stop-timer / overlay / plugin capabilities / `fix --auto-patch` / `motion`) and shipped as 0.2.0. The `/code-review` of the 0.2.1 follow-up (issue #7) then surfaced two **soundness** gaps in the core — both filed as issues, both undermining the AI-first thesis that a model can one-shot a *correct* app:

- **#24** — a panic raised on the **live** path (a reducer's `panic(...)`, `Result.get-err` on `Ok`, `Option/Result.get` on the empty case) propagates as an **uncaught exception out of the DOM event handler / render** instead of a controlled halt. The reducer-*test* harness already catches panics; the live runtime does not.
- **#23** — stdlib method shortcuts (`recv.method`, the parenthesis-free form) are dispatched **by name only, with no receiver type**, so a record/map field literally named like a method (`node.head` on `{head, tail}`) is **silently shadowed** by the method, and an unknown `recv.bogus` compiles to `undefined` with **no diagnostic**. This is the recurring "Gotcha 3" that bit #5 and #7.

v0.3's theme is therefore **type soundness & robustness**: make the runtime fail *cleanly* and make the compiler *see types* well enough to stop the silent-wrong-value class. No new end-user features — this is a correctness milestone.

The two items:

| # | Item | Source | Size |
|---|---|---|---|
| 1 | Clean panic handling on the live path (+ reconcile `.get` / `.get-err`) | [issue #24](https://github.com/kage1020/Kumiki/issues/24), [stdlib.md §2.2](../spec/stdlib.md), [lifecycle.md §7.3](../spec/lifecycle.md) | S |
| 2 | Receiver type inference for `FieldAccess` method-shortcut dispatch | [issue #23](https://github.com/kage1020/Kumiki/issues/23), [stdlib.md §2.2.3](../spec/stdlib.md) | L |

## Sequencing

Shipped as independent PRs, smallest-risk first so each lands green before the next starts:

```
M1  clean panic handling   (S, runtime + a top-level boundary + .get reconcile)
M2  receiver type inference (L, typecheck core: a type environment + inferType)
```

M1 is the runtime-local, lower-risk item and establishes the panic model the whole runtime can lean on. M2 is the larger, foundational change — it adds the type-light checker's first real type-inference pass — so it goes last and, like M5 in v0.2, **begins with an ADR** recording the inference approach before any code.

Each milestone, on completion, must satisfy the standard gate: `pnpm exec turbo run typecheck test lint build` green, every new example passes `check` + `build` + `smoke` (+ a scenario where it adds behavioral coverage), the relevant `spec/*.md` is reconciled with the implementation, the issue is closed, and `CHANGELOG` moves the item from *Planned* to *Fixed*.

---

## M1 — Clean panic handling on the live path

**Design.** A panic is Kumiki's controlled "stop the program" signal ([stdlib.md §2.2](../spec/stdlib.md): `panic(message) : never`, "inside a reducer only"; `Option/Result.get` "panics if None/Err"; `Result.get-err` "panics if Ok"). Today:

- `_stdlib.getErr` (`packages/runtime/src/index.ts`) `throw`s — the intended panic signal — but `_stdlib.unwrap` (the lowering of `.get`) **returns the value unchanged** on `None`/`Err`, so `.get` and `.get-err` behave *oppositely* (one of them violates the spec).
- The **reducer-test** harness wraps `apply(...)` in try/catch and reports `{panic}` (`codegen.ts` test emit) — but the **live** `applyReducer` has **no** try/catch, so a panic escapes the DOM event callback uncaught: the trailing `render()` never runs and the dispatch aborts mid-flight.
- Per-tile `error-boundary = X` *render* panics are already handled (codegen wraps the tile body in try/catch and renders the `PanicInfo` fallback, `codegen.ts` ~L1104). The gap is the **top level**: a render panic under a tile *without* an `error-boundary` (e.g. the root) still escapes.

M1 defines **one** panic model for the live runtime and implements it:

1. **Panic signal type.** Introduce a tagged `KumikiPanic` error so the runtime can distinguish a controlled panic from an arbitrary bug. `panic(msg)`, `Result.get-err` on `Ok`, `Option.get` on `None`, and `Result.get` on `Err` all raise it. (Reconciles `.get` with `.get-err`: per spec **both panic**.)
2. **Live reducer dispatch.** Wrap `r.apply(...)` in `applyReducer` in try/catch. A panic applies **no partial slot writes** (already atomic — writes happen only after `apply` returns), is logged (`console.error`), records a runtime panic state, and **halts further dispatch** ("stops the program": subsequent events become no-ops, like `disposed`; timers are cleared). It never propagates out of the event handler.
3. **Top-level render boundary.** Wrap the root tile build in `render()` so a render panic *not* caught by a per-tile `error-boundary` renders a top-level panic node (`PanicInfo`: message + location) instead of throwing. Per-tile boundaries still catch first.
4. **Verification tiers must still see panics.** A panic is a bug; the clean model must **not** hide it from tier-2/3. `smoke()` and `runScenario()` surface a recorded live panic as a failure (an uncaught panic was previously caught only as a thrown exception; now it's caught structurally — the structural signal must reach smoke).
5. **Reconcile examples.** Audit `.get` usage (the blog app uses `editor.get.title` / `loginError.get.message`, including inside a tile). If making `.get` panic breaks a render, the example was relying on the lenient behavior and is corrected (guard with `when(... is Some)` / switch to `.get-or`) — root-cause fix, consistent with the repo ethos.

**Acceptance Criteria.**
- AC1: `panic("msg")` inside a reducer raises a controlled `KumikiPanic`; the live dispatch catches it (no uncaught exception escapes the DOM event handler); verified by a runtime test.
- AC2: After a panic, slots reflect the **pre-dispatch** state (no partial writes) and subsequent reducer dispatches are no-ops ("stops the program"); verified by a runtime test.
- AC3: `Result.get-err` on `Ok`, `Option.get` on `None`, and `Result.get` on `Err` all panic via the **same** path — `.get` and `.get-err` are now consistent with [stdlib.md §2.2](../spec/stdlib.md).
- AC4: A render panic *not* caught by any `error-boundary` tile renders a top-level panic fallback (message + location) instead of throwing; an existing per-tile `error-boundary` still catches first (regression-guarded).
- AC5: `smoke()` / `runScenario()` report a live panic as a failure (the clean model does not hide panics from the verification tiers).
- AC6: New example `packages/examples/features/32-panic-boundary.kumiki` (a reducer that can panic + an `error-boundary` fallback) passes check + build + smoke; a scenario asserts the post-panic state.
- AC7: `spec/stdlib.md §2.2` (`.get`/`.get-err` panic semantics) is reconciled with the implementation; `spec/lifecycle.md §7.3` notes the live error-boundary as implemented; `spec/errors.md` and `CHANGELOG` are updated; issue #24 is closed.

**Affected.** `runtime` (`applyReducer` try/catch, `render()` top-level boundary, `_stdlib.unwrap`/`getErr`, panic state + smoke/scenario surfacing), `compiler` (only if a panic helper or top-level boundary needs codegen support), `spec/stdlib.md` + `spec/lifecycle.md` + `spec/errors.md`, `packages/examples/features/`, `tests/`.

---

## M2 — Receiver type inference for method-shortcut dispatch

**Design.** The checker is **type-light** today — name resolution + a11y + capabilities, with **no type inference** (`typecheck.ts` `checkExpr`'s `FieldAccess` case only recurses into the base; the local environment is a `Set<string>` of names, not name → type). So `codegen.ts` `jsOfExpr`'s `FieldAccess` case dispatches `recv.m` by matching `m` against a hardcoded method list **before** the `(base)[field]` field fallthrough — unconditionally. Consequences (issue #23):

- `node.head` on a record `{head, tail}` → `_s.listHead(node)` → `None` (silent wrong value); `r.abs` on `{abs, rel}` → `NaN`; `resp.get-err` on a record → **throws**.
- No escape hatch: the parenthesized form `node.head()` is also intercepted (`methodCallJs` + `KNOWN_METHODS`).
- No diagnostic: the no-paren `FieldAccess` path is never validated against `KNOWN_METHODS`, so an unknown `recv.bogus` compiles to `undefined` silently, and the "FieldAccess / methodCallJs / KNOWN_METHODS kept in sync" invariant is **asymmetric**.

M2 adds **the checker's first type-inference pass**, scoped to exactly what dispatch needs:

1. **Type environment.** Replace/augment the `Set<string>` local binds with a name → inferred-type map. Sources of type: slot declarations (typed), `fn` params (typed), tile `in=` (typed), `reducer` payload binds, `let` bindings (inferred from RHS), `match` pattern binds, `$1`/`$2` in method-arg lambdas, and literals.
2. **`inferType(expr)`.** A best-effort inferencer covering the constructs above plus method-call result types (`list.map(...)` → List, `.parse-int` → Option(Int), etc.). It returns an `unknown`/`dynamic` type when it genuinely can't decide — the inference is **sound where it speaks and silent where it doesn't**.
3. **Type-directed `FieldAccess` dispatch.** `recv.m` lowers to the method shortcut **only** when `recv`'s inferred type is a stdlib type that has `m`; when `recv` is a record/map with a field `m`, it lowers to field access (no shadow). The dispatch decision moves from "name in list" to "type has method".
4. **Diagnostics.** When the receiver type is **known** and has neither a field `m` nor a method `m`, emit a diagnostic (a new `E01xx undef-field`, or reuse the closest existing code — decided in the ADR) instead of silent `undefined`. When the type is **unknown/dynamic**, fall back to the current name-based behavior (back-compat; documented) so no existing program regresses to a *wrong value*.
5. **Symmetric invariant.** Add a build-time/test-time check that every `KNOWN_METHODS` entry has both a `FieldAccess` and a `methodCallJs` lowering — closing the structural gap PR #22 only guarded with a data-driven test.

**This change touches the type-checking foundation, so M2 begins with an ADR** (`design-notes/adr-002-receiver-type-inference.md`) recording the inference scope, the dispatch rule, the unknown-type fallback policy, and the new error code — mirroring how v0.2 M5 required ADR-001 before the motion layer.

**Acceptance Criteria.**
- AC1: A type environment maps in-scope names (slots / `fn` params / tile `in` / reducer payload / `let` / `match` binds / `$1`,`$2`) to an inferred type; `inferType` returns `dynamic` when undecidable.
- AC2: `recv.m` (no-paren) dispatches as a method shortcut **only** when `recv`'s inferred type has method `m`; a record/map field named `m` is read as a field (no shadow) — verified by a codegen test on a `{head, tail}` record and a List receiver in the same file.
- AC3: An unknown `recv.bogus` on a **known** receiver type is a compile diagnostic, not silent `undefined`.
- AC4: When the receiver type is `dynamic`/unknown, behavior matches today's name-based dispatch (no regression to a wrong value for the existing 12 argument-less + the arg-taking methods); documented.
- AC5: The "every `KNOWN_METHODS` method has a `FieldAccess` *and* a `methodCallJs` lowering" invariant is enforced by a test (a missing case fails the build, not silently lowers to `(x)["m"]`).
- AC6: `codegen.ts` `FieldAccess` dispatch consumes the inferred type rather than name-only.
- AC7: New example `packages/examples/features/33-field-vs-method.kumiki` — a record field named like a method read correctly + a method shortcut on a List/Option in one file — passes check + build + smoke (+ scenario if behavioral).
- AC8: The #23 known-limitation note in `CHANGELOG` is removed; the dispatch rule is documented in `spec/stdlib.md §2.2.3`; the new error code is catalogued in `spec/errors.md`; ADR-002 is written; issue #23 is closed.

**Affected.** `compiler` (`typecheck.ts` type environment + `inferType` + diagnostics; `codegen.ts` type-directed `FieldAccess` dispatch; `ast.ts`/`errors` for the new code), a new `design-notes/adr-002-*.md`, `spec/stdlib.md` + `spec/errors.md`, `packages/examples/features/`, `tests/`.

---

## Version strategy

- `main` is at **0.2.1** (v0.2 published; per-package npm tags exist).
- v0.3 work lands as M1 then M2 on independent feature branches; the umbrella `CHANGELOG` entry is `## [0.3.0]` with a *Planned* list that converts to *Fixed* per milestone.
- Both items are **soundness fixes catalogued as issues**, but they are still additive at the language level (M1 makes a previously-uncaught path controlled; M2 turns silent-wrong-value into a diagnostic) — a **minor** bump under pre-1.0 SemVer. M2's new diagnostic could reject a program that previously (silently, wrongly) compiled; that is a deliberate correctness tightening, documented in the CHANGELOG.
- When both milestones are green, bump the workspace to `0.3.0` via Changesets and let the release pipeline publish (repo public, OIDC + provenance — see [kumiki-npm-release]).

## Non-goals for v0.3

- No full Hindley-Milner / bidirectional type system. M2's inference is **minimal and dispatch-directed** — exactly enough to disambiguate field-vs-shortcut and flag unknown members; it is *not* a general type checker and does not add type-mismatch diagnostics beyond the member-resolution case.
- No change to the 7-layer model, no new end-user syntax, no React interop / human-first DX (unchanged from [rationale](./rationale.md)).
- M1 does not add a general exception-handling construct to the language; panic stays the single controlled-halt signal.
