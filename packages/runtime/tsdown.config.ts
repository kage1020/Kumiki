import { defineConfig } from "tsdown";

// @kumikijs/runtime has no runtime dependencies, so each entry is emitted as one
// self-contained file. Two artifacts are built from the same source:
//
// - `index` — readable ESM. The package entry, and the `./bundle` export that
//   codegen inlines into generated apps for smoke/run/test. It MUST stay
//   unminified: `inlineRuntime` strips the `export { … }` line and relies on the
//   top-level binding names matching the export names, and the AI debug loop
//   reads its stack traces.
// - `bundle.min` — minified ESM, the `./bundle.min` export. `kumiki build` ships
//   it as the app's `runtime.js`; it is consumed via a real `import`, so name
//   mangling is safe there.
export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: "esm",
    dts: true,
    // Emit .js/.d.ts (honors "type": "module") instead of tsdown's node-default .mjs.
    fixedExtension: false,
  },
  {
    entry: { "bundle.min": "src/index.ts" },
    format: "esm",
    dts: false,
    fixedExtension: false,
    minify: true,
    // The first config already cleaned dist/; cleaning here would race it.
    clean: false,
  },
]);
