// Definition store: parse a .kumiki file, record source ranges, and answer
// list / view / refs queries. Read-only on disk; mutations go through a
// separate path that rewrites the file and appends to the op-log.

import { readFileSync } from "node:fs";
import type { Def, Program, Token } from "@kumikijs/compiler";
import { lex, parse } from "@kumikijs/compiler";

export type DefRange = {
  /** 1-based start line in the source file. */
  startLine: number;
  /** 1-based end line, inclusive. */
  endLine: number;
};

export type DefEntry = {
  layer: string;
  name: string;
  def: Def;
  range: DefRange;
};

export type Store = {
  source: string;
  lines: string[];
  program: Program;
  defs: DefEntry[];
  byQName: Map<string, DefEntry>;
};

const LAYER_OF: Record<string, string> = {
  TypeDef: "type",
  SlotDef: "slot",
  EffectDef: "effect",
  ReducerDef: "reducer",
  TileDef: "tile",
  FnDef: "fn",
  AppDef: "app",
  ThemeDef: "theme",
  MotionDef: "motion",
};

export function load(path: string): Store {
  const source = readFileSync(path, "utf8");
  const lines = source.split(/\r?\n/);
  const tokens = lex(source);
  const program = parse(tokens);
  const defs = buildEntries(program, lines, tokens);
  const byQName = new Map<string, DefEntry>();
  for (const e of defs) byQName.set(`${e.layer}.${e.name}`, e);
  return { source, lines, program, defs, byQName };
}

function buildEntries(program: Program, lines: string[], tokens: Token[]): DefEntry[] {
  const out: DefEntry[] = [];
  for (let i = 0; i < program.defs.length; i++) {
    const d = program.defs[i]!;
    const layer = LAYER_OF[d.kind] ?? "?";
    const name = "name" in d ? d.name : "_";
    const start = (d as { pos?: { line: number } }).pos?.line ?? 1;
    // End line: just before the next def's start (or last line of file).
    const next = program.defs[i + 1];
    const nextStart = next && (next as { pos?: { line: number } }).pos?.line;
    const endLine = nextStart ? nextStart - 1 : lines.length;
    out.push({ layer, name, def: d, range: { startLine: start, endLine } });
  }
  // Trim trailing blank/comment lines from each range.
  for (const e of out) {
    let end = e.range.endLine;
    while (end > e.range.startLine) {
      const line = lines[end - 1] ?? "";
      if (line.trim() === "" || line.trim().startsWith("#")) end--;
      else break;
    }
    e.range.endLine = end;
  }
  void tokens;
  return out;
}

export function viewDef(store: Store, qname: string): string | null {
  const e = store.byQName.get(qname);
  if (!e) return null;
  return store.lines.slice(e.range.startLine - 1, e.range.endLine).join("\n");
}

export function viewWithDeps(store: Store, qname: string): string {
  const seen = new Set<string>();
  const order: string[] = [];
  const visit = (q: string): void => {
    if (seen.has(q)) return;
    seen.add(q);
    const refs = directDeps(store, q);
    for (const r of refs) visit(r);
    order.push(q);
  };
  visit(qname);
  return order
    .map((q) => viewDef(store, q))
    .filter((s) => s !== null)
    .join("\n\n");
}

/**
 * Return qnames that the definition at `qname` references. The match is
 * textual (identifier token in the source range) and intentionally over-
 * inclusive: any identifier that names another definition is considered a
 * dependency.
 */
export function directDeps(store: Store, qname: string): string[] {
  const e = store.byQName.get(qname);
  if (!e) return [];
  const body = store.lines.slice(e.range.startLine - 1, e.range.endLine).join("\n");
  const refs = new Set<string>();
  // Iterate over candidate identifiers in the body (skip comments and strings).
  const idents = body.matchAll(/[a-zA-Z_][a-zA-Z0-9_-]*/g);
  for (const m of idents) {
    const tok = m[0];
    if (!tok || tok === e.name) continue;
    for (const other of store.defs) {
      if (other === e) continue;
      if (other.name === tok) refs.add(`${other.layer}.${other.name}`);
    }
  }
  return Array.from(refs).sort();
}

export type RefSite = { qname: string; layer: string; name: string; line: number };

export function findReferences(store: Store, targetQname: string): RefSite[] {
  const target = store.byQName.get(targetQname);
  if (!target) return [];
  const out: RefSite[] = [];
  const targetName = target.name;
  for (const e of store.defs) {
    if (e === target) continue;
    for (let ln = e.range.startLine; ln <= e.range.endLine; ln++) {
      const line = store.lines[ln - 1] ?? "";
      // Strip comments + strings before matching.
      const cleaned = line.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/#.*$/, "");
      const re = new RegExp(`(^|[^a-zA-Z0-9_-])${escapeRegExp(targetName)}(?![a-zA-Z0-9_-])`);
      if (re.test(cleaned)) {
        out.push({
          qname: `${e.layer}.${e.name}`,
          layer: e.layer,
          name: e.name,
          line: ln,
        });
      }
    }
  }
  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function listDefs(store: Store, layer?: string): DefEntry[] {
  if (layer) return store.defs.filter((e) => e.layer === layer);
  return store.defs;
}
