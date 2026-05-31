# @strand/mcp

English · [日本語](./README.ja.md)

Exposes the Strand compiler and the AI editing toolchain as an **MCP (Model Context Protocol) server**. From editors or AI agents, you can check, build, navigate, edit, and look up the spec for Strand programs.

## Tools

| Tool | Purpose |
|---|---|
| `strand_check` | Parse + type-check `source` or `path` and return diagnostics |
| `strand_build` | Compile to a self-contained JS module (runtime inlined) |
| `strand_smoke` | Mount to a headless DOM and operate the UI to detect runtime exceptions, empty rendering, and unhandled rejections (the layer check/build don't catch) |
| `strand_run_scenario` | Drive the app with a scenario (operation sequence + state assertions), returning per-step slot state, DOM, errors, and emits as a trace. The substrate for the human-free generate → run → observe → fix loop |
| `strand_list` | List definitions in a file (filterable by layer) |
| `strand_view` | Show a single definition (with dependencies via `withDeps`) |
| `strand_refs` | Search for references to a definition |
| `strand_add` / `strand_replace` / `strand_remove` / `strand_rename` | Edit definitions |
| `strand_fix` | Propose auto-patches for fixable diagnostics |
| `strand_spec_search` / `strand_spec_list` / `strand_spec_get` | Search, list, and retrieve the normative spec (spec/) |

## Startup

```sh
pnpm --filter @strand/mcp start
```

Example configuration for an MCP client (e.g. Claude Code):

```json
{
  "mcpServers": {
    "strand": {
      "command": "node",
      "args": ["--import", "tsx", "packages/mcp/src/server.ts"]
    }
  }
}
```

The location of `spec/` is auto-resolved from the usual repository layout. For a different location, override it with the `STRAND_SPEC_DIR` environment variable.
