// strand fix — propose auto-patches for repairable typecheck errors.

import { readFileSync, writeFileSync } from "node:fs";
import type { StrandError } from "@strand/compiler";
import { check, lex, parse } from "@strand/compiler";
import { listDefs, load, type Store } from "./store.ts";

export type AutoPatch = {
  code: string;
  message: string;
  /** Free-form description of the fix to be applied. */
  description: string;
  apply: (text: string) => string;
};

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // Rolling single-row DP — `prev` holds the previous row's distances.
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const curr = [i, ...new Array<number>(n).fill(0)];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min((prev[j] ?? 0) + 1, (curr[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = curr;
  }
  return prev[n] ?? 0;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function suggestName(store: Store, missing: string): string | null {
  const all = listDefs(store).map((e) => e.name);
  let best: string | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const cand of all) {
    const d = levenshtein(missing, cand);
    if (d < bestScore) {
      bestScore = d;
      best = cand;
    }
  }
  // Accept the suggestion only if the names are close enough (≤ 2 edits or ≤ 25%).
  if (best === null) return null;
  if (bestScore <= 2 || bestScore <= Math.ceil(missing.length * 0.25)) return best;
  return null;
}

export function planFixes(store: Store, errors: StrandError[]): AutoPatch[] {
  const patches: AutoPatch[] = [];
  for (const err of errors) {
    if (
      err.code === "E0103" ||
      err.code === "E0105" ||
      err.code === "E0102" ||
      err.code === "E0104"
    ) {
      const match = /"([^"]+)"/.exec(err.message);
      if (!match) continue;
      const missing = match[1]!;
      const suggested = suggestName(store, missing);
      if (!suggested) continue;
      patches.push({
        code: err.code,
        message: err.message,
        description: `replace "${missing}" with "${suggested}" at ${err.pos.line}:${err.pos.col}`,
        apply: (text: string) => {
          const lines = text.split(/\r?\n/);
          const idx = err.pos.line - 1;
          const line = lines[idx] ?? "";
          const re = new RegExp(`\\b${escapeRegex(missing)}\\b`);
          lines[idx] = line.replace(re, suggested);
          return lines.join("\n");
        },
      });
    }
    if (err.code === "E0001") {
      patches.push({
        code: err.code,
        message: err.message,
        description: `add "/404" -> NotFound to app.routes (you must define a NotFound tile)`,
        apply: (text: string) => {
          // Append a NotFound tile + extend routes
          const need = `\ntile NotFound = page(heading("404"))\n`;
          // Inject "/404" -> NotFound before the closing brace of `routes = { ... }`.
          const re = /(routes\s*=\s*\{)([^}]*)(\})/;
          const replaced = text.replace(re, (_m, open: string, body: string, close: string) => {
            if (body.includes('"/404"')) return `${open}${body}${close}`;
            const trimmed = body.trimEnd();
            const sep = trimmed.endsWith(",") || trimmed.endsWith("{") ? "" : ",";
            return `${open}${body}${sep} "/404" -> NotFound ${close}`;
          });
          return need + replaced;
        },
      });
    }
  }
  return patches;
}

export function fixCmd(path: string, apply: boolean, onlyCode?: string): void {
  const store = load(path);
  const errors = check(store.program);
  if (errors.length === 0) {
    console.log("no errors");
    return;
  }
  let patches = planFixes(store, errors);
  if (onlyCode) patches = patches.filter((p) => p.code === onlyCode);
  if (patches.length === 0) {
    console.log("(no auto-patches available)");
    for (const e of errors) console.error(`${e.code} ${e.message}`);
    return;
  }
  if (!apply) {
    for (const p of patches) {
      console.log(`${p.code} ${p.message}`);
      console.log(`  fix: ${p.description}`);
    }
    return;
  }
  let text = readFileSync(path, "utf8");
  for (const p of patches) {
    text = p.apply(text);
  }
  writeFileSync(path, text);
  // Re-validate
  try {
    const next = parse(lex(text));
    const after = check(next);
    if (after.length === 0) console.log(`applied ${patches.length} fix(es) — file now clean`);
    else console.log(`applied ${patches.length} fix(es) — ${after.length} error(s) remain`);
  } catch (e) {
    console.error(`fixes broke the file: ${String(e)}`);
  }
}
