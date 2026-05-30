// Copy the canonical docs into the VitePress project root so the site can build
// with a normal (in-project) srcDir while spec/ etc. remain the single source.
// Run before `vitepress dev` / `vitepress build`. The copies are gitignored.

import { cpSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(siteDir, "..");

const dirs = ["spec", "guide", "examples", "design-notes"];

for (const d of dirs) {
  const dest = join(siteDir, d);
  rmSync(dest, { recursive: true, force: true });
  cpSync(join(repoRoot, d), dest, { recursive: true });
}

console.log(`synced docs into site/: ${dirs.join(", ")}`);
