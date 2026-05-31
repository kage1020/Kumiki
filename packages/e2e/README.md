# @kumiki/e2e

English · [日本語](./README.ja.md)

An **opt-in tier** that verifies Kumiki apps in a real browser (Chromium / Playwright). It catches layers invisible to jsdom — CSS layout, **real focus**, real rendering, and real events.

It uses the **same scenario format** as `@kumiki/runtime`'s jsdom `runScenario`, plus browser-only assertions:

- `focused`: that the given CSS selector is actually focused (detects focus-stealing bugs on re-render)
- `visible` / `hidden`: that it is really visible / invisible per computed style (visibility you can't tell from mere DOM presence, e.g. `display:none`)

The state oracle, as in the jsdom version, reads `window.__kumikiApp.live` (slot values) via `page.evaluate`. Displayed text is `innerText` (visible only).

## Usage

A one-time browser install is required:

```sh
pnpm --filter @kumiki/e2e exec playwright install chromium
```

Run:

```sh
pnpm --filter @kumiki/e2e exec tsx src/cli.ts <app.kumiki> <scenario.json> [--headed]
```

Example:

```sh
pnpm --filter @kumiki/e2e exec tsx src/cli.ts \
  examples/apps/06-expenses/app.kumiki \
  examples/apps/06-expenses/scenario.browser.json
```

## When to use it

Within the 3-layer verification ([spec/testing.md](../../spec/testing.md) §8.10), this is the heaviest but most faithful layer. Day to day, run `kumiki check` / `kumiki smoke` / `kumiki run` (jsdom, fast, CI standard), and use this tier for bugs involving focus, layout, or real rendering, or for final confirmation.

Because it's heavy (browser binaries), it's not included in the default `turbo run test`. To use it routinely in CI, add `playwright install chromium` to the workflow.
