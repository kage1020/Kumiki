# PoC Phase 4 — Theme, Styling, a11y, Error Boundary

English · [日本語](./poc-phase4.ja.md)

## 14.1 Goal

Since Phases 1–3 carried us through to a "working SPA," Phase 4 finishes off the **appearance** and **robustness**.

The samples reuse Counter / TodoMVC / Blog SPA as-is, and additional features improve the visuals / a11y / exception resilience.

## 14.2 Scope

| Covered | Details |
|---|---|
| Theme | Run `theme X = {...}` through parse + AST + codegen + runtime; both the `@colors.primary` form and the shorthand prop form (`bg: "primary"`) resolve from the theme. Theme switching (dark mode) via a slot is also possible |
| State styling | Apply `hover: {...}` / `focus: {...}` / `disabled: {...}` via dynamic pseudo-class CSS |
| Responsive | Style props accept the `{base, sm, md, lg, xl}` form and switch via media queries |
| a11y static checks | typecheck warns when `button` lacks `text`/`aria-label`, `image` lacks `alt`, `link` lacks inner text, and `input` inside a `form` lacks a `label`. `--strict-a11y` turns these into errors |
| Error boundary | The runtime captures `tile X error-boundary = Fallback`. When an exception occurs in a descendant render, it draws `Fallback(panicInfo)` |
| Animation | Automatically apply `transition: "fade" / "slide-up" / "slide-down"` and `transition-duration: "fast" / "normal" / "slow"` to a `when` toggle |

**Not handled** in Phase 4:
- Free-form arbitrary CSS
- Custom keyframes
- Low-level access to the Web Animations API
- Dynamic computation of focus trap / a11y-tree

## 14.3 Acceptance Criteria (AC)

### AC-Theme
- Parse `theme Dark = {...}`, and codegen passes it to the runtime as `_theme = {...}`
- With `box(...) {bg: "primary"}`, the `box` background becomes the value of `theme.colors.primary`
- Specifying `app.theme = Dark` applies the Dark theme globally
- `slot themeName : Text = "Light"` + `app.theme = themeName` re-themes via slot switching
- The `prefers-dark()` function detects the OS setting (callable inside a reducer)

### AC-State styling
- `button(text="X") {bg: "primary", hover: {bg: "primary-dark"}}` changes the background color on hover
- Automatic styling of the `disabled` state
- Outline reflection of the `focus` state

### AC-Responsive
- `column(...) {gap: {base: "sm", md: "lg"}}` changes the gap with the viewport width
- Breakpoints are taken from the theme's `breakpoints`

### AC-a11y
- `button(text="")` → warning E0701
- `image(src="x")` without alt → warning E0702
- `link(to="/x")` without inner text → warning E0703
- `--strict-a11y` turns these into errors and fails the build

### AC-Error boundary
- When something equivalent to `panic("oops")` occurs in the render of any tile, `Fallback(PanicInfo)` is drawn
- Other tiles outside the boundary render unaffected

### AC-Animation
- `when(modalOpen, Modal() {transition: "slide-up"})` slides up on display
- The 3 duration levels (fast=150ms, normal=300ms, slow=600ms)

### AC-E2E
- Blog SPA E2E operation with navigate / fetch mock on jsdom
- Apply a theme to Counter / TodoMVC and verify visually in the browser

## 14.4 Implementation Order

| step | Content | Validation |
|---|---|---|
| 1 | Theme parse + AST + codegen + runtime | snapshot + browser |
| 2 | Theme resolution of shorthand props | snapshot |
| 3 | State styling (hover/focus/disabled) | browser |
| 4 | Responsive breakpoints | browser |
| 5 | a11y checks | typecheck test |
| 6 | Error boundary runtime | runtime test + jsdom |
| 7 | Animation | browser |
| 8 | Blog SPA E2E + theming the existing examples | jsdom |

## 14.5 Design Decisions

| Decision | Reason |
|---|---|
| Theme tokens are not expanded at **compile time** | Runtime resolve so the theme can be switched via a slot |
| State styling is dynamic CSS injection (data-strand-id + pseudo-class) | There is no way to write hover with inline styles |
| Responsive does not watch the viewport size | Switch per-breakpoint classes with `matchMedia` |
| a11y defaults to warnings | For compatibility with the existing examples. `--strict-a11y` turns them into errors |
| The error boundary is try/catch-based | Captures exceptions during render, per tile hierarchy |
| 3 fixed animations | Custom ones are deferred to Phase 5 |

## 14.6 Definition of Done

- All AC pass
- The existing 46 tests + the tests added in Phase 4 (theme/state/responsive/a11y/error-boundary/animation) all pass
- Verify visually in the browser that Counter / TodoMVC / Blog SPA look improved
