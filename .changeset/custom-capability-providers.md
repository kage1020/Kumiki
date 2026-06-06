---
"@kumikijs/runtime": minor
"@kumikijs/compiler": minor
---

feat: host capability providers — the inbound ecosystem seam

Custom capabilities (registered via `kumiki.caps.json`) can now be backed by a
host-supplied implementation, so a Kumiki app can use any npm library / SDK
without language-level FFI.

- `mount(app, target, { providers })` accepts a `Record<string, CapabilityProvider>`
  keyed by capability name. New runtime exports: `CapabilityProvider`,
  `MountOptions`; `CapabilityRegistry` gains `provider(cap)`.
- Codegen now lowers a custom-capability effect to a provider lookup at the
  capability boundary (`caps.provider(cap)`) instead of an always-failing
  "not implemented" stub. With no provider registered it resolves to
  `err {message: "Capability <name> has no provider"}`.
- The auto-mounted bundle threads `globalThis.__kumikiProviders` so an embedding
  host can register providers before the module loads.

Standard capabilities keep their built-in implementations (not provider-overridable),
and scenario mocks still override providers at the same boundary. See
docs/spec/stdlib.md §2.5.
