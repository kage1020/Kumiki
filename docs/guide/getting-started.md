# Getting Started

Kumiki is an experimental, AI-first web framework. You describe an app as small, interlocking definitions — no JSX, Hooks, dependency arrays, or hidden state — and the toolchain compiles it to a plain browser app. This page takes you from zero to a running example in a few minutes.

> Brand new to the language itself? [Thinking in Kumiki](./thinking-in-kumiki.md) explains the model, and the [examples](https://github.com/kage1020/Kumiki/tree/main/packages/examples) show real apps. To build one line by line, jump to [Your First App](./your-first-app.md).

## Try it without installing

The fastest taste is the [Playground](./playground.md): it runs the compiler and runtime entirely in your browser. Pick an example, edit on the left, and watch it render on the right — no clone, no install.

Work locally (below) when you want the CLI, MCP, or your own files.

## What a Kumiki program looks like

A counter is just a few declarations — `slot` is state, `reducer` turns an event into a state change, `tile` projects state to UI, and `app` wires it together:

```kumiki
slot count : Int = 0

reducer inc on=ui.click(IncBtn) do= count := count + 1

tile IncBtn = button(text="+1")
tile App    = column(heading("Count: " + count), IncBtn)

app Counter
    caps   = []
    routes = {"/" -> App, "/404" -> App}
    init   = []
```

That is the whole mental model. The full example (with `-` and `reset`) is [packages/examples/apps/01-counter/app.kumiki](https://github.com/kage1020/Kumiki/blob/main/packages/examples/apps/01-counter/app.kumiki), and the seven layers are covered in [Thinking in Kumiki](./thinking-in-kumiki.md).

## Set up locally

You need **Node.js 22+** and **pnpm**. Kumiki is not published to npm yet, so you run it from a clone of the repository:

```sh
git clone https://github.com/kage1020/Kumiki.git
cd Kumiki
pnpm install        # links the workspace packages — required before any command
pnpm build          # build all packages
pnpm test           # optional: confirm every package turns green
```

`pnpm install` is what makes the `kumiki` command and the cross-package imports work, so don't skip it.

## Run your first example

The repo ships a `kumiki` script that runs the CLI from the repo root, so paths are relative to where you are:

**Check** — parse and type-check a `.kumiki` file:

```sh
pnpm kumiki check packages/examples/apps/01-counter/app.kumiki
# → ok
```

**Build** — compile to a static app:

```sh
pnpm kumiki build packages/examples/apps/01-counter/app.kumiki ./out
# → Wrote out/index.html, app.js, runtime.js
```

Open `out/index.html` in a browser and the counter works: "Count: 0" with buttons that increment, decrement, and reset. `app.js` is the generated pure logic; `runtime.js` is the DOM runtime (minified, ~15KB gzip).

**Smoke** — confirm it actually runs, not just compiles. This mounts the app in a headless DOM and clicks through it:

```sh
pnpm kumiki smoke packages/examples/apps/01-counter/app.kumiki
# → ok — mounted, rendered, 3 interaction(s), no runtime errors
```

Run `pnpm kumiki` with no arguments to list every subcommand (`build` / `check` / `smoke` / `list` / `view` / `refs` / `run`).

## When something fails

Check errors carry a code and a location:

```
E0103 undef-ref at 3:39: Reference to undefined name "total"
```

The code (here `E0103`) names the category — look it up in the [error catalog](../spec/errors.md). Most failures are a typo or a missing definition, and [Thinking in Kumiki](./thinking-in-kumiki.md) plus the [recipes](./recipes.md) cover the common fixes.

If a command itself errors out:

- `Cannot find package '@kumiki/compiler'` or `tsx: command not found` → you skipped `pnpm install`; run it.
- A path-not-found on the `.kumiki` file → check the path is relative to the repo root (that is where `pnpm kumiki` runs).

## Editor / AI integration (MCP)

`@kumiki/mcp` exposes check, build, edit, and spec-search as MCP tools, so an AI agent can drive Kumiki end to end. For an example client configuration, see [packages/mcp/README.md](https://github.com/kage1020/Kumiki/blob/main/packages/mcp/README.md).

## Next

- [Your First App](./your-first-app.md) — write a Counter from scratch, one layer at a time.
- [Thinking in Kumiki](./thinking-in-kumiki.md) — the 7 layers and how they differ from React.
- [Examples](https://github.com/kage1020/Kumiki/tree/main/packages/examples) — minimal per-feature samples and complete apps.
- [Playground](./playground.md) — keep experimenting in the browser.
