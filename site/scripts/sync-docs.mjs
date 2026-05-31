// Copy the canonical docs into the VitePress project root so the site can build
// with a normal (in-project) srcDir while spec/ etc. remain the single source.
// Run before `vitepress dev` / `vitepress build`. The copies are gitignored.
//
// English pages come from `*.md` and land in `site/<dir>/`. Japanese pages come
// from their `*.ja.md` siblings, get the `.ja` stripped, and land in
// `site/ja/<dir>/` so VitePress serves them as the `ja` locale under `/ja/`.
// Non-Markdown assets are mirrored into both trees so relative links resolve.

import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(siteDir, "..");

const dirs = ["spec", "guide", "examples", "design-notes"];

// The language-switch line is only useful when browsing the repo on GitHub
// (where `name.md` and `name.ja.md` sit side by side). On the site the native
// locale switcher replaces it, so strip it from the generated copies.
const SWITCH_RE =
  /^(?:English · \[日本語\]\([^)]*\)|\[English\]\([^)]*\) · 日本語)\s*$/;

function stripSwitchLine(content) {
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (SWITCH_RE.test(lines[i])) {
      const drop = i + 1 < lines.length && lines[i + 1].trim() === "" ? 2 : 1;
      lines.splice(i, drop);
      break;
    }
  }
  return lines.join("\n");
}

function walkFiles(dir, base = dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(abs, base));
    else out.push(relative(base, abs));
  }
  return out;
}

// VitePress serves a directory index from `index.md`, not `README.md`. Rename
// README pages so nav/sidebar links like `/spec/` resolve to the overview page.
function toPageRel(rel) {
  return rel.replace(/(^|[/\\])README\.md$/, "$1index.md");
}

function writeText(dest, text) {
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, text);
}

function copyAsset(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest);
}

for (const d of dirs) {
  const src = join(repoRoot, d);
  const enDest = join(siteDir, d);
  const jaDest = join(siteDir, "ja", d);
  // Non-Markdown assets go under `public/` so VitePress emits them verbatim;
  // files alongside Markdown in srcDir are dropped from the build, which would
  // make every `*.strand` link 404 on the deployed site.
  const enPub = join(siteDir, "public", d);
  const jaPub = join(siteDir, "public", "ja", d);
  rmSync(enDest, { recursive: true, force: true });
  rmSync(jaDest, { recursive: true, force: true });
  rmSync(enPub, { recursive: true, force: true });
  rmSync(jaPub, { recursive: true, force: true });

  for (const rel of walkFiles(src)) {
    const abs = join(src, rel);
    if (rel.endsWith(".ja.md")) {
      const jaRel = toPageRel(`${rel.slice(0, -".ja.md".length)}.md`);
      writeText(join(jaDest, jaRel), stripSwitchLine(readFileSync(abs, "utf8")));
    } else if (rel.endsWith(".md")) {
      writeText(join(enDest, toPageRel(rel)), stripSwitchLine(readFileSync(abs, "utf8")));
    } else {
      // Shared non-Markdown asset (e.g. *.strand, *.json): mirror into both
      // locale trees under `public/` so `/examples/.../x.strand` and its `/ja/`
      // counterpart resolve to the served file.
      copyAsset(abs, join(enPub, rel));
      copyAsset(abs, join(jaPub, rel));
    }
  }
}

// Home page: English `index.md` stays at the root; the Japanese home is
// generated from `index.ja.md` into `ja/index.md`.
const jaHomeSrc = join(siteDir, "index.ja.md");
writeText(join(siteDir, "ja", "index.md"), stripSwitchLine(readFileSync(jaHomeSrc, "utf8")));

console.log(`synced docs into site/ and site/ja/: ${dirs.join(", ")}`);
