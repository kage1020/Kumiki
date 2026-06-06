---
"@kumikijs/runtime": minor
---

feat: `defineKumikiElement` — embed a compiled app as a Web Component (outbound seam)

Wrap a compiled Kumiki app as a standard custom element so it drops into any host
page or framework (React/Vue/Svelte/plain HTML) without a Kumiki-specific
integration. The element owns the mount lifecycle (mount on connect, dispose on
disconnect) and bridges the host both ways:

- **Inbound** — `options.providers` forward to `mount` (the custom-capability
  seam); `options.attributeSlots` map observed attributes to slots; imperative
  `setSlot`/`setSlots`/`getSlot`/`slots` read & write live state (refinements
  enforced).
- **Outbound** — `options.events` surface custom-capability effects as DOM
  `CustomEvent`s on the element; a `providers[cap]` entry overrides the
  passthrough for that capability.

New exports: `defineKumikiElement`, `KumikiElementOptions`, `AttributeSlotBinding`.
Renders into light DOM; single-instance per imported app module. See
docs/spec/runtime.md §10.9.1.
