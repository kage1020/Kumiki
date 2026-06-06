---
"@kumikijs/runtime": minor
"@kumikijs/compiler": minor
---

feat: standard capabilities are now host-provider-overridable

Every effect invoke (standard and custom) consults `caps.provider(cap)` before
its built-in implementation. A host can therefore register a provider for a
*standard* capability — `http.*`, `storage.*`, `nav.*`, `notification.show`,
`log.write` — to swap the HTTP transport (axios / ofetch), inject auth headers,
integrate a framework router, or replace the toast UI, without touching the
Kumiki source. The provider receives the effect's (already `map-request`-mapped)
request; with no provider registered the built-in behavior runs unchanged.

- `codegen` now lowers every effect to the uniform shape *map → provider check →
  built-in fallback* (custom caps fall back to the existing "no provider" error).
- The runtime built-ins (navigate / toast / log) defer to a registered provider
  for their capability before running the default behavior.
