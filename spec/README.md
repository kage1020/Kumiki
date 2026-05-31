# Kumiki Specification

English · [日本語](./README.ja.md)

This is the **normative specification** of the Kumiki language and runtime. When the implementation (`packages/`) and this specification disagree, this specification is, as a rule, taken as authoritative, and which side to fix is recorded as a design decision (→ [Design Notes](../design-notes/)).

Tutorials and how-tos are not specification and live in [Kumiki Guide](../guide/). Working examples are in [Kumiki Examples](../examples/).

## Table of Contents

| Document | Contents |
|---|---|
| [Language Core](./language.md) | the 7 layers (type / slot / effect / reducer / tile / fn / app) and expressions, statements, patterns |
| [Standard Library](./stdlib.md) | List / Map / Set / Option / Result / Time / domain types |
| [Routing](./routing.md) |patterns, parameters, `route.enter` / `route.leave`, redirects |
| [Style](./style.md) | Style, layout, and themes |
| [Forms](./forms.md) | Forms, `bind`, validation |
| [HTTP / Storage](./http.md) | HTTP / Storage effects and policies (latest / debounce / once …) |
| [Lifecycle](./lifecycle.md) | Lifecycle, capabilities, error boundaries, suspense |
| [Runtime](./runtime.md) | Runtime implementation guide (signal graph, mount, dispatch, dispose) |
| [AI Editing](./ai-edit.md) | AI editing API, CRDT ops, referential integrity |
| [Testing](./testing.md) | Testing strategy |
| [Error Codes](./errors.md) | Error code catalog (E0001..E07xx) |
