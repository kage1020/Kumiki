---
layout: home

hero:
  name: Kumiki
  text: A web framework of AI, by AI, for AI
  tagline: Definitions interlock like Japanese joinery (kumiki) — no JSX, no Hooks, no hidden state — so AI can write, edit, and reassemble an app in parallel. Experimental.
  image:
    light: /kumiki-mark-animated.svg
    dark: /kumiki-mark-animated-dark.svg
    alt: Kumiki
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Playground
      link: /guide/playground
    - theme: alt
      text: Spec
      link: /spec/

features:
  - title: 7 layers
    details: type / slot / effect / reducer / tile / fn / app. State, side effects, and UI are split by role, with no implicit rules.
  - title: Easy for AI to edit in parts
    details: Each definition is independent and references are explicit. The CLI and MCP server provide per-definition list / view / add / replace / fix.
  - title: Measured ease of learning
    details: Cross-vendor (Claude / Codex / Gemini) — mid-size apps (~600 LOC) build from the spec alone in a single pass; larger ones still need an edit loop.
  - title: Answers everything with working examples
    details: Comprehensive per-feature minimal examples and apps ordered by size. Questions and bugs are answered by adding an example and a test.
---
