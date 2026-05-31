# Playground

English · [日本語](./playground.ja.md)

You can edit → compile → preview Strand in the browser. The compiler (`@strand/compiler`) and runtime (`@strand/runtime`) run inside the browser. Edit on the left and the result appears on the right. From `Choose an example…` you can load each example from the [feature catalog](../examples/features/).

<Playground />

## WebMCP

For [WebMCP](https://github.com/webmachinelearning/webmcp)-capable browsers/agents, this page exposes tools via `navigator.modelContext.registerTool` (effective only in supporting environments).

| Tool | Purpose |
|---|---|
| `strand_compile` | Compiles the given Strand source and returns success/failure and diagnostics (read-only) |
| `strand_list_examples` | Returns the list of the playground's per-feature examples (read-only) |
| `strand_load_example` | Loads an example into the editor by name |
| `strand_set_source` | Replaces the editor's source and previews it |

For local CLI / editor integration, there is also the [`@strand/mcp`](https://github.com/kage1020/strand/tree/main/packages/mcp) server that runs over stdio.
