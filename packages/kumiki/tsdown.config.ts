import { defineConfig } from "tsdown";

// `kumiki` is the convenience entry: it ships only the `kumiki` executable,
// which delegates to @kumikijs/cli (auto-externalized as a dependency).
// No library surface, so no dts.
export default defineConfig({
  entry: { kumiki: "src/kumiki.ts" },
  format: "esm",
  dts: false,
  fixedExtension: false,
});
