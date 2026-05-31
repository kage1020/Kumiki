# Playground

English · [日本語](./playground.ja.md)

You can edit → compile → preview Kumiki in the browser. The compiler (`@kumiki/compiler`) and runtime (`@kumiki/runtime`) run inside the browser. Edit on the left and the result appears on the right. From `Choose an example…` you can load each example from the [feature catalog](../examples/features/).

<Playground />

## WebMCP

For [WebMCP](https://github.com/webmachinelearning/webmcp)-capable browsers/agents, this page exposes tools via `navigator.modelContext.registerTool` (effective only in supporting environments).

| Tool | Purpose |
|---|---|
| `kumiki_compile` | Compiles the given Kumiki source and returns success/failure and diagnostics (read-only) |
| `kumiki_list_examples` | Returns the list of the playground's per-feature examples (read-only) |
| `kumiki_load_example` | Loads an example into the editor by name |
| `kumiki_set_source` | Replaces the editor's source and previews it |

For local CLI / editor integration, there is also the [`@kumiki/mcp`](https://github.com/kage1020/kumiki/tree/main/packages/mcp) server that runs over stdio.
