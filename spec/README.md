# Strand Specification (spec/)

English · [日本語](./README.ja.md)

This is the **normative specification** of the Strand language and runtime. When the implementation (`packages/`) and this specification disagree, this specification is, as a rule, taken as authoritative, and which side to fix is recorded as a design decision (→ [../design-notes/](../design-notes/)).

Tutorials and how-tos are not specification and live in [../guide/](../guide/). Working examples are in [../examples/](../examples/).

## Table of Contents

| Document | Contents |
|---|---|
| [language.md](./language.md) | Language core — the 7 layers (type / slot / effect / reducer / tile / fn / app) and expressions, statements, patterns |
| [stdlib.md](./stdlib.md) | Standard library — List / Map / Set / Option / Result / Time / domain types |
| [routing.md](./routing.md) | Routing — patterns, parameters, `route.enter` / `route.leave`, redirects |
| [style.md](./style.md) | Style, layout, and themes |
| [forms.md](./forms.md) | Forms, `bind`, validation |
| [http.md](./http.md) | HTTP / Storage effects and policies (latest / debounce / once …) |
| [lifecycle.md](./lifecycle.md) | Lifecycle, capabilities, error boundaries, suspense |
| [runtime.md](./runtime.md) | Runtime implementation guide (signal graph, mount, dispatch, dispose) |
| [ai-edit.md](./ai-edit.md) | AI editing API, CRDT ops, referential integrity |
| [testing.md](./testing.md) | Testing strategy |
| [errors.md](./errors.md) | Error code catalog (E0001..E07xx) |
