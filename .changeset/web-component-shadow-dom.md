---
"@kumikijs/runtime": minor
---

feat: `defineKumikiElement({ shadow: true })` — shadow-DOM style isolation

The Web Component wrapper can now render into an open shadow root for full style
encapsulation. The app's motion / theme / state `<style>` nodes are injected into
the shadow root (not the document head) and theme background/foreground/font are
applied to an in-shadow container, so host-page CSS does not bleed in and
Kumiki's CSS does not leak out. Light DOM (the document-level styling that
matches a standalone page) remains the default.

`mount` gains `styleRoot?: Document | ShadowRoot` and `styleHost?: HTMLElement`
options that route every Kumiki `<style>` injection (animations, motion, theme,
state styles) to the chosen root — the seam the shadow element uses. Style
injection no longer references the global `Document` constructor, keeping non-DOM
imports of the runtime safe.
