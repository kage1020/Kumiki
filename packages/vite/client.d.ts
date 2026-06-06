// Ambient module types for Kumiki source imports. Reference once in your project
// (e.g. in a vite-env.d.ts or tsconfig "types"):
//
//   /// <reference types="@kumikijs/vite/client" />
//
// Then `import App from "./app.kumiki"` is typed as the compiled AppShape.

declare module "*.kumiki" {
  const app: import("@kumikijs/runtime").AppShape;
  export default app;
  /** Build an independent instance — use for multiple mounts / Web Component instances. */
  export function createApp(): import("@kumikijs/runtime").AppShape;
}
