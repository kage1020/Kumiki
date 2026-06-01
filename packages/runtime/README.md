# @kumikijs/runtime

Kumiki DOM runtime — mounts compiled Kumiki apps, dispatches effects, and manages the signal graph. Part of [Kumiki](https://github.com/kage1020/Kumiki).

You normally do not import this directly: the compiler embeds the runtime into generated apps. It is published so generated apps and tooling can resolve it.

## Install

```sh
npm i @kumikijs/runtime
```

## Exports

- `@kumikijs/runtime` — the runtime API (`mount`, `runScenario`, `smoke`, …).
- `@kumikijs/runtime/bundle` — the prebuilt, self-contained runtime bundle as a single file, embedded verbatim into generated apps.

## License

Apache-2.0
