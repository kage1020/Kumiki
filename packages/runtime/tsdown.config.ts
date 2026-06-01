import { defineConfig } from "tsdown";

// @kumikijs/runtime has no runtime dependencies, so the single `index` entry is
// emitted as one self-contained file. That same file doubles as the `./bundle`
// export consumed by the compiler/codegen (read from disk and embedded into
// generated apps).
export default defineConfig({
  entry: { index: "src/index.ts" },
  format: "esm",
  dts: true,
  // Emit .js/.d.ts (honors "type": "module") instead of tsdown's node-default .mjs.
  fixedExtension: false,
});
