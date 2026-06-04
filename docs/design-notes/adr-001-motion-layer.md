# ADR 001 — `motion` is a top-level definition, a sibling of `theme` (not an 8th layer)

- **Status:** Accepted (2026-06-03)
- **Milestone:** v0.2 M5 ([roadmap](./roadmap-v0.2.md))
- **Spec:** [style.md §4.9](../spec/style.md), [language.md §1.1](../spec/language.md)

## Context

v0.1 ships a closed set of three `transition` tokens (`fade` / `slide-up` / `slide-down`) auto-applied to `when`-toggled tiles ([style.md §4.9](../spec/style.md)). v0.2 M5 adds a declarative **`motion`** feature for reusable, arbitrary (but still closed-grammar) animations — spinners, pulses, custom enter/exit — without opening a raw-CSS escape hatch ([style.md §4.10](../spec/style.md) invariant).

The roadmap flagged one decision as requiring an ADR *before* implementation: **does `motion` become an 8th layer in the documented 7-layer model, or something else?** ([roadmap M5](./roadmap-v0.2.md)).

## Decision

**`motion` is a top-level definition kind modeled exactly on `theme` — a named, reusable, purely-presentational definition that is NOT counted among the "7 layers."**

The deciding observation is that **the 7-layer model already describes only the logic/data/UI core**, and Kumiki already has presentational/meta definition kinds outside it:

- [language.md §1.1.1](../spec/language.md) lists exactly seven *layers* — `type` / `slot` / `effect` / `reducer` / `tile` / `fn` / `app` — and its EBNF `definition ::= type-def | … | app-def` **omits `theme-def` and `test-def` entirely**, even though both are real top-level definitions.
- `theme` carries a `store.ts` `LAYER_OF` entry but is not in the layer table; `test` is loosely called "the sixth layer" in [testing.md §8.1](../spec/testing.md) yet is excluded from the production build.

So the "7 layers" are the **semantic core the AI must learn to express behavior**. `theme`, `test`, and now `motion` are **auxiliary declarative vocabularies** (design tokens, behavior assertions, animations) that sit alongside the seven without expanding the behavioral learning target. This preserves the [rationale](./rationale.md) non-goal ("no macros/DSL extensions; keep the AI's learning target single") — `motion` adds a *closed presentational vocabulary*, not new logic syntax, exactly as `theme` did.

`motion` therefore:
- uses a top-level `motion Name = { … }` definition whose body is a **record literal**, parsed by the same `parseThemeRecord` path as `theme` (so its values can only be literals/nested records — **purity is structural**: you cannot write a slot reference or effect call inside it, satisfying M5 AC4 by construction);
- is referenced from any tile via the `motion` prop (`tile Loader = icon(name="spinner") {motion: "Spin"}`), the same place the `transition` prop already lives;
- is documented in `spec/style.md` (alongside `transition`), and `spec/language.md` gains a short note that `theme` / `test` / `motion` are auxiliary definitions outside the seven layers (closing the pre-existing EBNF gap).

### Alternatives rejected

- **Promote to a documented 8th layer.** Rejected: it inflates the core learning target and the language's headline identity for a purely presentational concern, and would force `theme` (equally presentational) to be promoted too for consistency. The 7-layer model is about *behavior*; animation is decoration.
- **No new keyword; bury animations in `theme`/`style`.** Rejected: a `theme.animations` block conflates two distinct concerns (design tokens vs. time-based behavior), gives motion no first-class name to reference or `kumiki view`, and complicates theme validation. A named sibling definition keeps motion statically locatable and AI-editable.

## Motion grammar (closed, no raw CSS)

```kumiki
motion Spin = {
    keyframes: {from: {rotate: 0}, to: {rotate: 360}},
    duration:  "normal",      # "fast" | "normal" | "slow", or a positive Int (ms)
    easing:    "linear",      # linear | ease | ease-in | ease-out | ease-in-out
    iteration: "infinite",    # a positive Int, or "infinite"
    direction: "normal"       # normal | reverse | alternate | alternate-reverse
}
```

- **`keyframes`** (required): a record with `from` and `to`, each a record over the **closed animatable property set**:
  | property | unit | CSS target |
  |---|---|---|
  | `opacity` | 0..1 | `opacity` |
  | `translate-x` / `translate-y` | px (number) | `transform: translateX/Y(…px)` |
  | `scale` | number | `transform: scale(…)` |
  | `rotate` | deg (number) | `transform: rotate(…deg)` |

  Multiple transform properties on one stop compose into a single `transform`. Unknown properties are a compile error (**E0401**).
- **Timing fields** are optional (defaults: `duration:"normal"`, `easing:"ease"`, `iteration:1`, `direction:"normal"`). Values outside the closed sets are a compile error (**E0402**).
- A missing/malformed `keyframes` (no `from`/`to`, non-record) is **E0403**.
- A tile prop `motion: "X"` naming an undefined motion is **E0107 `undef-motion`** (name-resolution band).

### Codegen & runtime

`codegen` emits a `_motions` registry next to `_themes` and sets `App.motions`. At mount the runtime injects one `<style id="kumiki-motions">` containing, per motion `M`: a `@keyframes kumiki-motion-M { … }` and a `.kumiki-motion-M { animation: … }` rule (mirroring the existing `kumiki-animations` block for `transition`). `applyContainerProps` / text props add the `kumiki-motion-M` class when a tile has `motion: "M"`. The style block ends with `@media (prefers-reduced-motion: reduce) { .kumiki-motion-*, .kumiki-anim { animation: none !important } }` (M5 AC5). Because the keyframes are scoped to generated class names and injected by the runtime, the [style.md §4.10](../spec/style.md) "no global CSS" invariant holds. It composes with `when(...)` and `overlay` (M2) because it is just a class on the toggled/overlaid tile (AC3).

## Acceptance Criteria (M5)

- AC1: `motion N = {keyframes, …}` parses; the grammar is closed (closed property + timing sets; no raw CSS string). Out-of-set property/timing → E0401/E0402; malformed keyframes → E0403.
- AC2: a tile referencing a motion by name applies it at runtime via a generated, scoped class; an undefined name is E0107.
- AC3: enter/exit motion composes with `when(...)` and `overlay` (M2).
- AC4: motion is purely presentational — it cannot read/write slots or emit effects (structural: the body is a literal record).
- AC5: `prefers-reduced-motion: reduce` disables motion (and the v0.1 transitions); documented in `spec/style.md`.
- AC6: a new `packages/examples/features/` example (spinner + animated modal) passes check + build + smoke; a `@kumikijs/e2e` browser scenario covers what jsdom can't observe.
- AC7: this ADR records the decision; `spec/style.md` gains the motion grammar and loses the "introduced in the v0.2 `motion` layer" sentence; `spec/language.md` notes the auxiliary-definition distinction.

## Deferred (follow-ups, tracked here)

- **Multi-stop keyframes** (`{0: …, 50: …, 100: …}` percentage offsets) — v0.2 motion is `from`/`to` only, which covers spinners, pulses, fades, and slides. Percentage stops need numeric record keys in the grammar.
- **More animatable properties** (color/background tweening, `blur`, `skew`, per-axis scale) — the closed set is intentionally small to start.
- **Motion as the engine for `transition`** — the v0.1 `transition` tokens remain a separate built-in block; unifying them onto `motion` is a later cleanup.

## Consequences

- One new keyword-free top-level form (`motion`, dispatched like `theme`), one new runtime style block, four new error codes (E0107, E0401–E0403). No change to the seven logic layers.
- `spec/language.md` is clarified so the long-standing `theme`/`test` EBNF omission is explained rather than latent.
