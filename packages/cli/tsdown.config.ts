import { defineConfig } from "tsdown";

// @kumikijs/cli ships the programmatic API (`index`) plus the `kumiki` executable.
// The kumiki.ts shebang (#!/usr/bin/env node) is preserved by tsdown.
// Workspace deps (@kumikijs/compiler, @kumikijs/runtime) are auto-externalized.
export default defineConfig({
  entry: { index: "src/index.ts", kumiki: "src/kumiki.ts" },
  format: "esm",
  dts: true,
  // Emit .js/.d.ts (honors "type": "module") instead of tsdown's node-default .mjs.
  fixedExtension: false,
});
