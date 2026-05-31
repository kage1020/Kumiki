# Kumiki v0.2 Roadmap

English · [日本語](./roadmap-v0.2.ja.md)

This document defines the scope, design approach, and acceptance criteria (AC) for the v0.2 milestone. It is the planning counterpart to the per-feature design that lives in `spec/` and the working examples in `examples/`. Implementation follows the repo's TDD flow: **Design → AC → tests → implementation → iterate** ([CONTRIBUTING](../CONTRIBUTING.md)).

## Goals

v0.1 reached the point where an AI one-shot-writes a 1300 LOC SaaS-class SPA (see [learning-cost-v4](./learning-cost-v4.md)). v0.2 closes the five gaps the spec itself already marks as **"planned for v0.2"**, so that the language stops deferring and the deferred wording is removed from `spec/`. No fundamental redesign — each item is additive and independently shippable.

The five items, with their spec source:

| # | Item | Spec source | Size |
|---|---|---|---|
| 1 | `stop-timer(name)` — explicit timer stop | [lifecycle.md §7.1.5](../spec/lifecycle.md) | S |
| 2 | `overlay` builtin — z-axis stacking | [style.md §4.4.3](../spec/style.md) | S |
| 3 | Plugin capability registration | [stdlib.md §2.5](../spec/stdlib.md) | M |
| 4 | `kumiki fix --auto-patch <test-name>` — fix from test failures | [testing.md §8.7.1](../spec/testing.md) | M |
| 5 | `motion` layer — arbitrary transitions / keyframes | [style.md §4.0, §4.9](../spec/style.md) | L |

## Sequencing

Shipped as independent PRs, smallest-risk first so each lands green before the next starts:

```
M1  stop-timer            (S, runtime + parser + codegen)
M2  overlay               (S, parser + codegen + runtime layout)
M3  plugin capabilities   (M, typecheck + runtime dispatch + manifest)
M4  fix --auto-patch      (M, cli + test-runner integration)
M5  motion layer          (L, spec doc + parser + codegen + runtime)
```

M1–M2 are mechanical and unblock confidence in the toolchain. M5 is last because it is the largest surface and benefits from M2 (`overlay`) being in place (modals/toasts are the primary motion consumers).

Each milestone, on completion, must satisfy the standard gate: `pnpm exec turbo run typecheck test lint build` green, every new example passes `check` + `build` + `smoke`, the relevant `spec/*.md` loses its "planned for v0.2" sentence, and `CHANGELOG` moves the item from *Planned* to *Added*.

---

## M1 — `stop-timer(name)`

**Design.** Today `timer(d)` is `setInterval`-based and only cleared on `app` dispose ([lifecycle.md §7.1.5](../spec/lifecycle.md)). v0.2 adds a named-timer registry so a reducer can stop a specific recurring timer. The trigger `timer(d)` gains an optional name (`timer(1s, name=tick)`); a reducer can `emit stop-timer(tick)` (or a `stop-timer(tick)` statement) to clear that interval. Names are local to the app and statically known, so the compiler can validate that a stopped name corresponds to a declared `timer(... name=...)` trigger.

**Acceptance Criteria.**
- AC1: A `timer(d, name=N)` trigger registers a named interval; `N` must be a bare identifier unique within the app (duplicate → new `E07xx`).
- AC2: `stop-timer(N)` from a reducer clears the interval `N`; subsequent ticks do not fire.
- AC3: `stop-timer(N)` referencing an undeclared timer name is a compile error (new code in the `E06xx`/`E07xx` band, catalogued in `spec/errors.md`).
- AC4: A stopped timer can be restarted only by remount (no implicit auto-restart); documented in lifecycle.
- AC5: On `app` dispose, all named timers (running or stopped) are cleared (no leak); verified by a runtime test.
- AC6: New example `examples/features/NN-stop-timer.kumiki` (e.g. a countdown that stops at 0) passes check + build + smoke; a scenario asserts the slot stops advancing after stop.

**Affected.** `compiler` (lexer/parser for `name=`, typecheck name validation, codegen emit), `runtime` (named interval registry + clear), `spec/lifecycle.md` + `spec/errors.md`, `examples/features/`, `tests/`.

---

## M2 — `overlay` builtin

**Design.** Add `overlay(...children)` as a layout builtin for z-axis stacking ([style.md §4.4.3](../spec/style.md)). It renders a positioned container where children stack on the z-axis (the first child is the base layer, later children overlay it), the canonical substrate for modals, toasts, dropdowns, and tooltips. Props: `align` (placement of overlaid children: `center` / `top` / `bottom` / corners), and the standard style props. It composes with the existing `when(...)`/`transition` visibility machinery, so M5's motion can animate overlay entry/exit.

**Acceptance Criteria.**
- AC1: `overlay(Base, Layer1, Layer2)` renders a stacking context; `Base` occupies normal flow, later children are absolutely positioned over it.
- AC2: `align` prop positions overlaid children (`center` default); invalid token → existing style-prop validation error.
- AC3: An overlaid child toggled by `when(open, Modal())` mounts/unmounts correctly and does not shift the base layer's layout.
- AC4: Reset/embedded CSS keeps overlay self-contained (no global CSS escape hatch — consistent with [style.md §4.10](../spec/style.md)).
- AC5: New example `examples/features/NN-overlay.kumiki` (a modal over content) passes check + build + smoke.
- AC6: The "use `position` on `box`, or the `overlay` builtin planned for the future" note in `spec/style.md` is replaced by the shipped spec.

**Affected.** `compiler` (parser builtin registration, codegen to positioned DOM + CSS), `runtime` (mount/layout), `spec/style.md`, `examples/features/`, `tests/`.

---

## M3 — Plugin capability registration

**Design.** Today writing an unlisted capability in `app.caps` is a compile error, and the standard set is fixed ([stdlib.md §2.5](../spec/stdlib.md)). v0.2 introduces a **capability manifest** so a project can register additional capabilities + their effect signatures without forking the compiler. The manifest is a declarative file (e.g. `kumiki.caps.json` / a workspace field) resolved by the CLI and compiler; it maps a capability name → the effect descriptor shape it authorizes. Registered capabilities then pass `app.caps` validation and their effects become emittable. This is **declarative registration, not arbitrary code** — consistent with the non-goal "no macros/plugins that expand the AI's learning target" ([rationale](./rationale.md)): a plugin can add a *capability boundary*, not new syntax.

**Acceptance Criteria.**
- AC1: A capability declared in the manifest is accepted in `app.caps` without a compile error.
- AC2: An effect bound to a registered capability is emittable from a reducer and dispatched at the capability boundary (mockable in scenarios, like standard effects).
- AC3: A capability not in the standard set **and** not in the manifest remains a compile error (the safety property is preserved).
- AC4: The manifest schema is validated; a malformed manifest is a clear CLI error (not a crash).
- AC5: Scenario runner mocks registered effects deterministically (same contract as standard effects), so `run` traces stay reproducible.
- AC6: New example under `examples/features/` (a custom capability, e.g. a domain-specific effect) plus a manifest, passing check + build + smoke + scenario.
- AC7: The "planned via a plugin in v0.2" sentence in `spec/stdlib.md` is replaced with the registration spec.

**Affected.** `compiler` (caps validation reads manifest), `runtime`/`scenario` (custom effect dispatch + mocking), `cli` (manifest resolution), `mcp` (expose manifest awareness), `spec/stdlib.md` + `spec/http.md`/`spec/lifecycle.md` (capability docs), `examples/`, `tests/`.

---

## M4 — `kumiki fix --auto-patch <test-name>`

**Design.** Today `kumiki fix` proposes patches only for a fixed set of **typecheck** errors (`E0102`–E0105 name typos, `E0001` missing `/404`) via `planFixes` in `packages/cli/src/fix.ts`. v0.2 extends `fix` to consume **test failures** ([testing.md §8.7.1](../spec/testing.md)): given a failing `<test-name>` from the runner, it analyzes the expected-vs-actual diff (and, where available, the scenario trace / smoke error) and proposes a patch to the `.kumiki` source. The existing `AutoPatch { code, message, description, apply }` shape is reused; the patch source expands from "compiler error list" to "test-failure report". `--auto-patch` applies and re-runs the named test to confirm green (mirroring the existing apply-then-re-check loop).

**Acceptance Criteria.**
- AC1: `kumiki fix --auto-patch <test-name>` resolves the named test, runs it, and on failure produces ≥1 candidate patch (or a clear "no auto-patch available" with the diff).
- AC2: For a snapshot/display mismatch (expected tile tree ≠ actual), the proposed patch targets the responsible tile/reducer; applying it makes that test pass.
- AC3: For a runtime/smoke failure surfaced as a known error code, `fix` reuses the M-existing `planFixes` path.
- AC4: Without `--auto-patch` (dry-run), it prints the proposed patch and does not modify files (consistent with current `fix` dry-run behavior).
- AC5: After applying, the named test is re-run; output states whether it now passes and whether other tests regressed.
- AC6: A regression test in `tests/` (or `packages/cli/test/`) covers: failing test → propose → apply → pass.
- AC7: The "planned for v0.2" sentence in `spec/testing.md §8.7.1` is replaced with the shipped behavior.

**Affected.** `cli` (`fix.ts` extended, test-runner hook), `runtime` (expose structured failure/trace for `fix` to consume), `spec/testing.md`, `tests/`.

---

## M5 — `motion` layer

**Design.** v0.1 ships only a closed set of `transition` tokens (`fade` / `slide-up` / `slide-down`) auto-applied to `when`-toggled tiles ([style.md §4.9](../spec/style.md)). v0.2 introduces a dedicated, declarative **`motion` layer** for arbitrary transitions and keyframe animations while preserving Kumiki's "no global CSS, all decoration self-contained" invariant ([style.md §4.10](../spec/style.md)). A `motion` definition names a reusable animation (keyframes + timing), referenced from a tile prop (`motion=Spin` style) — keeping it statically locatable and AI-editable, unlike free-form CSS. This is the one item that may **add an 8th layer** to the 7-layer model; that decision (new layer vs. an extension of `style`) is the first design task of M5 and must be recorded as an ADR in this directory before implementation.

**Acceptance Criteria.**
- AC1: A `motion` definition declares named keyframes + timing (duration / easing / iteration / direction) with a small, closed grammar (no raw CSS string escape hatch).
- AC2: A tile references a motion by name; the runtime applies it without leaking global CSS (scoped to the tile, consistent with §4.10).
- AC3: Enter/exit motion composes with `when(...)` and `overlay` (M2) — a modal can animate in/out.
- AC4: Motion is purely presentational: it cannot read/write slots or emit effects (preserves layer purity; verified by typecheck).
- AC5: `prefers-reduced-motion` is honored (a11y), documented in `spec/style.md`.
- AC6: New `examples/features/` example (e.g. a spinner + an animated modal) passes check + build + smoke; a browser-tier (`@kumiki/e2e`) check where jsdom can't observe animation.
- AC7: An ADR records the layer-vs-extension decision; `spec/` gains the motion grammar; the "introduced in the v0.2 `motion` layer" sentence in §4.9 is replaced.

**Affected.** `spec/style.md` (+ possibly `spec/language.md` if a layer is added) + a new ADR in `design-notes/`, `compiler` (lexer/parser for the layer, typecheck purity, codegen to scoped CSS/keyframes), `runtime` (apply/scope motion), `examples/features/`, `@kumiki/e2e`, `tests/`.

---

## Version strategy

- The current `main` is the **v0.1 baseline** (workspace version `0.1.0`, untagged — no git tags exist yet).
- v0.2 work lands as the milestones above on independent feature branches; the umbrella CHANGELOG entry is `## [0.2.0]` with a *Planned* list that converts to *Added* per milestone.
- When all five milestones are green, bump workspace versions to `0.2.0` and tag `v0.2.0`.
- SemVer note: pre-1.0 experimental — additive features are minor bumps; the deferred-feature removals from `spec/` are not breaking (they only add capability).

## Non-goals for v0.2

Unchanged from [rationale](./rationale.md): no React interop, no human-first DX, no macros/arbitrary DSL extension (the manifest in M3 adds a capability boundary, **not** syntax), no dynamic types, DOM-only target. Motion (M5) does not open a raw-CSS escape hatch.
