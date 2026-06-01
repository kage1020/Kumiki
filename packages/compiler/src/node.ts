// Node-only helpers for @kumikijs/compiler. Kept out of the main entrypoint so
// the compiler core stays browser-safe (no node: imports in the barrel).

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

/**
 * Reads the prebuilt @kumikijs/runtime bundle from disk. Pass as
 * `compile(source, { bundle: true, readRuntimeBundle: nodeRuntimeBundleReader })`.
 */
export function nodeRuntimeBundleReader(): string {
  const require = createRequire(import.meta.url);
  const runtimeBundlePath = require.resolve("@kumikijs/runtime/bundle");
  return readFileSync(runtimeBundlePath, "utf8");
}
