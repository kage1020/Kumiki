---
"@kumikijs/runtime": patch
---

`spinner` renders an animated, accessible loading ring instead of a static "…" placeholder.

The previous renderer set `textContent = "…"`, so `Loading` states (e.g. the
`stdlib §2.3.8` feedback tile used by the HTTP showcase) never showed an actual
spinner. The tile now renders a rotating `currentColor` ring with
`role="status"` / `aria-label="Loading"`; the `@keyframes kumiki-spin` rule
lives in the shared animation stylesheet, so it works in any style root
(document or shadow) and is disabled under `prefers-reduced-motion`. The `size`
prop accepts the `sm` / `md` / `lg` / `xl` tokens (spec now states this);
without it the ring scales with the surrounding text.
