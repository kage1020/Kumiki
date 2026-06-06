// Walk benchmarks/scenarios/* and report patch statistics for each one.
// Each scenario directory must contain:
//   - kumiki-modified.kumiki
//   - react-modified.tsx
// They are diffed against the baseline files at the project root.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encode as encodeCl100k } from "gpt-tokenizer/encoding/cl100k_base";
import { encode as encodeO200k } from "gpt-tokenizer/encoding/o200k_base";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "../../benchmarks");
const KUMIKI_BASE = resolve(ROOT, "../docs/examples/02-todomvc.kumiki");
const REACT_BASE = resolve(ROOT, "todomvc-react/src/App.tsx");

function readSplit(p) {
  return readFileSync(p, "utf8").split(/\r?\n/);
}

function diffStats(baseLines, modLines) {
  const n = baseLines.length;
  const m = modLines.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (baseLines[i] === modLines[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  let added = 0;
  let removed = 0;
  let addedText = "";
  let removedText = "";
  while (i < n && j < m) {
    if (baseLines[i] === modLines[j]) {
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      removed++;
      removedText += `${baseLines[i]}\n`;
      i++;
    } else {
      added++;
      addedText += `${modLines[j]}\n`;
      j++;
    }
  }
  while (i < n) {
    removed++;
    removedText += `${baseLines[i]}\n`;
    i++;
  }
  while (j < m) {
    added++;
    addedText += `${modLines[j]}\n`;
    j++;
  }
  const patch = addedText + removedText;
  return {
    added,
    removed,
    chars: patch.length,
    cl100k: encodeCl100k(patch).length,
    o200k: encodeO200k(patch).length,
  };
}

const baseKumiki = readSplit(KUMIKI_BASE);
const baseReact = readSplit(REACT_BASE);

const scenarios = readdirSync(resolve(ROOT, "scenarios"))
  .filter((n) => statSync(resolve(ROOT, "scenarios", n)).isDirectory())
  .sort();

const rows = [];
for (const sc of scenarios) {
  const dir = resolve(ROOT, "scenarios", sc);
  const kumikiMod = readSplit(join(dir, "kumiki-modified.kumiki"));
  const reactMod = readSplit(join(dir, "react-modified.tsx"));
  const kumiki = diffStats(baseKumiki, kumikiMod);
  const react = diffStats(baseReact, reactMod);
  rows.push({ sc, kumiki, react });
}

const fmt = (n) => String(n).padStart(7);
console.log("");
console.log("Per-scenario patch sizes (lines / chars / tokens)");
console.log("");
console.log(
  `${"scenario".padEnd(24)} ${"impl".padEnd(7)}  ${"+lines".padStart(7)}  ${"-lines".padStart(7)}  ${"chars".padStart(7)}  ${"cl100k".padStart(7)}  ${"o200k".padStart(7)}`,
);
console.log("-".repeat(78));
for (const r of rows) {
  console.log(
    `${r.sc.padEnd(24)} ${"kumiki".padEnd(7)}  ${fmt(r.kumiki.added)}  ${fmt(r.kumiki.removed)}  ${fmt(r.kumiki.chars)}  ${fmt(r.kumiki.cl100k)}  ${fmt(r.kumiki.o200k)}`,
  );
  console.log(
    `${"".padEnd(24)} ${"react".padEnd(7)}  ${fmt(r.react.added)}  ${fmt(r.react.removed)}  ${fmt(r.react.chars)}  ${fmt(r.react.cl100k)}  ${fmt(r.react.o200k)}`,
  );
}

// Aggregate totals
const totals = rows.reduce(
  (acc, r) => {
    for (const k of ["added", "removed", "chars", "cl100k", "o200k"]) {
      acc.kumiki[k] = (acc.kumiki[k] ?? 0) + r.kumiki[k];
      acc.react[k] = (acc.react[k] ?? 0) + r.react[k];
    }
    return acc;
  },
  { kumiki: {}, react: {} },
);

console.log("");
console.log("Totals across scenarios");
console.log(
  `  kumiki : +${totals.kumiki.added}/-${totals.kumiki.removed}  chars=${totals.kumiki.chars}  cl100k=${totals.kumiki.cl100k}  o200k=${totals.kumiki.o200k}`,
);
console.log(
  `  react  : +${totals.react.added}/-${totals.react.removed}  chars=${totals.react.chars}  cl100k=${totals.react.cl100k}  o200k=${totals.react.o200k}`,
);
console.log("");
console.log("React / Kumiki ratios (totals)");
console.log(`  +lines : ${(totals.react.added / totals.kumiki.added).toFixed(2)}x`);
console.log(`  chars  : ${(totals.react.chars / totals.kumiki.chars).toFixed(2)}x`);
console.log(`  cl100k : ${(totals.react.cl100k / totals.kumiki.cl100k).toFixed(2)}x`);
console.log(`  o200k  : ${(totals.react.o200k / totals.kumiki.o200k).toFixed(2)}x`);
