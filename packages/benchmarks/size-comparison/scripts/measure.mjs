// Compare LOC / character / token counts between the Kumiki source and the
// equivalent React implementation. Tokenizes with cl100k_base (GPT-4 family)
// and o200k_base (GPT-4o family) for two reference points.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { encode as encodeCl100k } from "gpt-tokenizer/encoding/cl100k_base";
import { encode as encodeO200k } from "gpt-tokenizer/encoding/o200k_base";

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, "..");

function loc(text) {
  let total = 0;
  let blank = 0;
  let comment = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    total++;
    if (line === "") {
      blank++;
      continue;
    }
    if (line.startsWith("//") || line.startsWith("#") || line.startsWith("*")) {
      comment++;
    }
  }
  return { total, blank, comment, code: total - blank - comment };
}

function collect(paths) {
  let buf = "";
  for (const p of paths) buf += `${readFileSync(p, "utf8")}\n`;
  return buf;
}

function measure(label, paths) {
  const combined = collect(paths);
  const lines = loc(combined);
  return {
    label,
    files: paths.length,
    chars: combined.length,
    locTotal: lines.total,
    locCode: lines.code,
    cl100k: encodeCl100k(combined).length,
    o200k: encodeO200k(combined).length,
  };
}

function render(rows) {
  const headers = ["label", "files", "chars", "loc-total", "loc-code", "cl100k", "o200k"];
  const widths = headers.map((h) => h.length);
  for (const r of rows) {
    widths[0] = Math.max(widths[0], r.label.length);
    widths[1] = Math.max(widths[1], String(r.files).length);
    widths[2] = Math.max(widths[2], String(r.chars).length);
    widths[3] = Math.max(widths[3], String(r.locTotal).length);
    widths[4] = Math.max(widths[4], String(r.locCode).length);
    widths[5] = Math.max(widths[5], String(r.cl100k).length);
    widths[6] = Math.max(widths[6], String(r.o200k).length);
  }
  const pad = (s, w) => String(s).padEnd(w);
  const line = (cols) => cols.map((c, i) => pad(c, widths[i])).join("  ");
  const sep = widths.map((w) => "-".repeat(w)).join("  ");
  const out = [line(headers), sep];
  for (const r of rows) {
    out.push(line([r.label, r.files, r.chars, r.locTotal, r.locCode, r.cl100k, r.o200k]));
  }
  return out.join("\n");
}

const KUMIKI = resolve(ROOT, "../../examples/apps/02-todomvc/app.kumiki");
const REACT_APP = resolve(ROOT, "todomvc-react/src/App.tsx");

const rows = [
  measure("kumiki (02-todomvc/app.kumiki)", [KUMIKI]),
  measure("react  (App.tsx)", [REACT_APP]),
];
console.log(render(rows));

// Save a machine-readable copy.
const json = {
  generatedAt: new Date().toISOString(),
  rows,
  ratio: {
    chars: rows[1].chars / rows[0].chars,
    locCode: rows[1].locCode / rows[0].locCode,
    cl100k: rows[1].cl100k / rows[0].cl100k,
    o200k: rows[1].o200k / rows[0].o200k,
  },
};
console.log("\nReact / Kumiki ratios:");
console.log(`  chars   : ${json.ratio.chars.toFixed(2)}x`);
console.log(`  loc-code: ${json.ratio.locCode.toFixed(2)}x`);
console.log(`  cl100k  : ${json.ratio.cl100k.toFixed(2)}x`);
console.log(`  o200k   : ${json.ratio.o200k.toFixed(2)}x`);

process.stdout.write("");
