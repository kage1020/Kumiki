# Getting Started

English · [日本語](./getting-started.ja.md)

## Requirements

- Node.js 22+
- pnpm

## Setup

```sh
git clone <this-repo>
cd Kumiki
pnpm install
pnpm build
pnpm test     # Confirm that tests for all packages turn green
```

## Checking a Kumiki Program

Parse and type-check a `.kumiki` file:

```sh
pnpm --filter @kumiki/cli exec tsx src/kumiki.ts check examples/apps/01-counter/app.kumiki
# → ok
```

If there are errors, they are shown with a code (e.g. `E0103 undef-ref at 5:12: ...`). See [../spec/errors.md](../spec/errors.md) for their meanings.

## Building and Running

```sh
pnpm --filter @kumiki/cli exec tsx src/kumiki.ts build examples/apps/01-counter/app.kumiki ./out
# → Wrote ./out/index.html, app.js, runtime.js
```

Open `out/index.html` in a browser and it runs. `app.js` is the generated pure logic, and `runtime.js` is the DOM runtime.

## Editor / AI Integration (MCP)

`@kumiki/mcp` exposes checking, building, editing, and spec search as MCP tools. For an example MCP client configuration, see [packages/mcp/README.md](https://github.com/kage1020/Kumiki/blob/main/packages/mcp/README.md).

## Next

Write a Counter from scratch in [Your First App](./your-first-app.md).
