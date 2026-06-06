// Compute the "AI edit op-stream" cost for each scenario: what does it cost
// (chars + tokens) to express the change as a sequence of `kumiki add /
// replace / remove` operations on the source file, vs. shipping the whole
// modified file or a unified diff?

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encode as encodeCl100k } from "gpt-tokenizer/encoding/cl100k_base";
import { load } from "../src/cli/store.ts";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "../../benchmarks");
const KUMIKI_BASE_PATH = resolve(ROOT, "../docs/examples/02-todomvc.kumiki");

function tokenCount(s) {
  return encodeCl100k(s).length;
}

function formatOp(op) {
  switch (op.kind) {
    case "add":
      return `add ${op.layer} ${op.name} ${op.body}`;
    case "replace":
      return `replace ${op.layer}.${op.name} ${op.body}`;
    case "remove":
      return `remove ${op.layer}.${op.name}`;
  }
}

function bodyOf(text, range) {
  const lines = text.split(/\r?\n/);
  return lines.slice(range.startLine - 1, range.endLine).join("\n");
}

function diffOps(basePath, modPath) {
  const baseStore = load(basePath);
  const modStore = load(modPath);
  const baseSrc = baseStore.source;
  const modSrc = modStore.source;
  const ops = [];

  const baseQ = new Set(baseStore.byQName.keys());
  const modQ = new Set(modStore.byQName.keys());

  // removed: in base, not in mod
  for (const q of baseQ) {
    if (!modQ.has(q)) {
      const e = baseStore.byQName.get(q);
      ops.push({ kind: "remove", layer: e.layer, name: e.name });
    }
  }
  // added: in mod, not in base
  for (const q of modQ) {
    if (!baseQ.has(q)) {
      const e = modStore.byQName.get(q);
      const body = bodyOf(modSrc, e.range);
      ops.push({ kind: "add", layer: e.layer, name: e.name, body });
    }
  }
  // replaced: in both, body differs
  for (const q of baseQ) {
    if (!modQ.has(q)) continue;
    const a = baseStore.byQName.get(q);
    const b = modStore.byQName.get(q);
    const aBody = bodyOf(baseSrc, a.range);
    const bBody = bodyOf(modSrc, b.range);
    if (aBody !== bBody) {
      ops.push({ kind: "replace", layer: a.layer, name: a.name, body: bBody });
    }
  }
  return ops;
}

// Compute the unified-diff patch cost (lines only — same logic as
// measure-scenarios.mjs, replicated locally for the report).
function diffPatch(baseSrc, modSrc) {
  const a = baseSrc.split(/\r?\n/);
  const b = modSrc.split(/\r?\n/);
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  let patch = "";
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      patch += `${a[i]}\n`;
      i++;
    } else {
      patch += `${b[j]}\n`;
      j++;
    }
  }
  while (i < n) {
    patch += `${a[i]}\n`;
    i++;
  }
  while (j < m) {
    patch += `${b[j]}\n`;
    j++;
  }
  return patch;
}

const scenarios = readdirSync(resolve(ROOT, "scenarios"))
  .filter((n) => statSync(resolve(ROOT, "scenarios", n)).isDirectory())
  .sort();

const rows = [];
for (const sc of scenarios) {
  const dir = resolve(ROOT, "scenarios", sc);
  const modPath = join(dir, "kumiki-modified.kumiki");
  const ops = diffOps(KUMIKI_BASE_PATH, modPath);
  const opText = ops.map(formatOp).join("\n");
  const modSrc = readFileSync(modPath, "utf8");
  const baseSrc = readFileSync(KUMIKI_BASE_PATH, "utf8");
  const patch = diffPatch(baseSrc, modSrc);
  rows.push({
    sc,
    opCount: ops.length,
    fullChars: modSrc.length,
    fullTokens: tokenCount(modSrc),
    patchChars: patch.length,
    patchTokens: tokenCount(patch),
    opChars: opText.length,
    opTokens: tokenCount(opText),
  });
}

const fmt = (n) => String(n).padStart(7);
console.log("");
console.log("Kumiki edit cost per scenario (full file vs unified patch vs op stream)");
console.log("");
console.log(
  `${"scenario".padEnd(24)} ${"#ops".padStart(5)}  ${"full ch".padStart(7)}  ${"full tk".padStart(7)}  ${"patch ch".padStart(7)}  ${"patch tk".padStart(8)}  ${"op ch".padStart(7)}  ${"op tk".padStart(7)}`,
);
console.log("-".repeat(95));
for (const r of rows) {
  console.log(
    `${`${r.sc.padEnd(24)} ${fmt(r.opCount).slice(-5)}  ${fmt(r.fullChars)}  ${fmt(r.fullTokens)}  ${fmt(r.patchChars)}  ${fmt(r.patchTokens)} `.padEnd(
      75,
    )} ${fmt(r.opChars)}  ${fmt(r.opTokens)}`,
  );
}

const totals = rows.reduce(
  (acc, r) => {
    acc.opCount += r.opCount;
    acc.fullChars += r.fullChars;
    acc.fullTokens += r.fullTokens;
    acc.patchChars += r.patchChars;
    acc.patchTokens += r.patchTokens;
    acc.opChars += r.opChars;
    acc.opTokens += r.opTokens;
    return acc;
  },
  {
    opCount: 0,
    fullChars: 0,
    fullTokens: 0,
    patchChars: 0,
    patchTokens: 0,
    opChars: 0,
    opTokens: 0,
  },
);

console.log("");
console.log("Totals (Kumiki only)");
console.log(`  #ops total      : ${totals.opCount}`);
console.log(`  full-file chars : ${totals.fullChars}`);
console.log(`  full-file tokens: ${totals.fullTokens}`);
console.log(`  patch chars     : ${totals.patchChars}`);
console.log(`  patch tokens    : ${totals.patchTokens}`);
console.log(`  op-stream chars : ${totals.opChars}`);
console.log(`  op-stream tokens: ${totals.opTokens}`);
console.log("");
console.log("Reduction (lower is better)");
console.log(
  `  op vs full-file : chars ${((totals.opChars / totals.fullChars) * 100).toFixed(1)}%   tokens ${((totals.opTokens / totals.fullTokens) * 100).toFixed(1)}%`,
);
console.log(
  `  op vs patch     : chars ${((totals.opChars / totals.patchChars) * 100).toFixed(1)}%   tokens ${((totals.opTokens / totals.patchTokens) * 100).toFixed(1)}%`,
);
