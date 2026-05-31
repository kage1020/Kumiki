// Mutating commands for the kumiki CLI. Each mutation rewrites the .kumiki
// file and appends an entry to `<file>.kumiki-ops.jsonl`.

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { check, lex, parse } from "@kumiki/compiler";
import { findReferences, load } from "./store.ts";

const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
function ulid(): string {
  let s = "op_";
  for (let i = 0; i < 16; i++) s += ULID_ALPHABET[Math.floor(Math.random() * 32)];
  return s;
}

function logOp(path: string, op: Record<string, unknown>): void {
  const enriched = { ...op, opId: ulid(), ts: Date.now() };
  appendFileSync(`${path}.kumiki-ops.jsonl`, `${JSON.stringify(enriched)}\n`);
}

/**
 * Validate that after the write the file still parses and typechecks.
 * Returns the error list (empty array = success).
 */
function validate(path: string): { ok: true } | { ok: false; message: string } {
  try {
    const src = readFileSync(path, "utf8");
    const program = parse(lex(src));
    const errors = check(program);
    if (errors.length > 0) {
      const summary = errors
        .slice(0, 3)
        .map((e) => `${e.code} ${e.message}`)
        .join("; ");
      return { ok: false, message: `Validation failed: ${summary}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: `Parse/lex failed: ${String(e)}` };
  }
}

export function addDef(path: string, layer: string, name: string, body: string): void {
  const src = readFileSync(path, "utf8");
  // Compose definition syntax for the requested layer. The body argument is
  // the right-hand side (e.g. "Int = 0" for a slot, "Bool -> Bool = not $1" for
  // a fn). Layer-specific assembly is small enough to inline here.
  const inserted = assemble(layer, name, body);
  const next = src.endsWith("\n") ? `${src}\n${inserted}\n` : `${src}\n\n${inserted}\n`;
  writeFileSync(path, next);
  const v = validate(path);
  if (!v.ok) {
    // roll back
    writeFileSync(path, src);
    throw new Error(`add rejected: ${v.message}`);
  }
  logOp(path, { op: "add", layer, name, body });
}

export function replaceDef(path: string, qname: string, body: string): void {
  const store = load(path);
  const entry = store.byQName.get(qname);
  if (!entry) throw new Error(`Definition "${qname}" not found`);
  const before = store.lines.slice(0, entry.range.startLine - 1);
  const after = store.lines.slice(entry.range.endLine);
  const inserted = assemble(entry.layer, entry.name, body).split(/\r?\n/);
  const next = [...before, ...inserted, ...after].join("\n");
  const original = store.source;
  writeFileSync(path, next);
  const v = validate(path);
  if (!v.ok) {
    writeFileSync(path, original);
    throw new Error(`replace rejected: ${v.message}`);
  }
  logOp(path, { op: "replace", layer: entry.layer, name: entry.name, body });
}

export function removeDef(path: string, qname: string, cascade: boolean): void {
  const store = load(path);
  const entry = store.byQName.get(qname);
  if (!entry) throw new Error(`Definition "${qname}" not found`);
  const refs = findReferences(store, qname);
  if (refs.length > 0 && !cascade) {
    const summary = refs
      .slice(0, 5)
      .map((r) => `${r.qname}:${r.line}`)
      .join(", ");
    throw new Error(
      `Cannot remove ${qname}: ${refs.length} references (${summary}). Re-run with --cascade.`,
    );
  }
  // Cascade: collect distinct dependent qnames and remove them too. We do it
  // in dependency order — remove the leaves first.
  const toRemove = new Set<string>([qname]);
  if (cascade) {
    let frontier = [qname];
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const q of frontier) {
        for (const r of findReferences(store, q)) {
          if (!toRemove.has(r.qname)) {
            toRemove.add(r.qname);
            next.push(r.qname);
          }
        }
      }
      frontier = next;
    }
  }
  // Remove from bottom up so line numbers stay valid.
  const removalEntries = [...toRemove]
    .map((q) => store.byQName.get(q))
    .filter((e): e is NonNullable<typeof e> => !!e)
    .sort((a, b) => b.range.startLine - a.range.startLine);
  let lines = store.lines.slice();
  for (const e of removalEntries) {
    lines = [...lines.slice(0, e.range.startLine - 1), ...lines.slice(e.range.endLine)];
  }
  const next = lines.join("\n");
  const original = store.source;
  writeFileSync(path, next);
  const v = validate(path);
  if (!v.ok) {
    writeFileSync(path, original);
    throw new Error(`remove rejected: ${v.message}`);
  }
  logOp(path, { op: "remove", layer: entry.layer, name: entry.name, cascade });
}

export function renameDef(path: string, qname: string, newName: string): void {
  const store = load(path);
  const entry = store.byQName.get(qname);
  if (!entry) throw new Error(`Definition "${qname}" not found`);
  const old = entry.name;
  // Replace `old` as a whole word, but leave commented or stringed occurrences
  // alone. Line-by-line so we can skip past `#` and inside `"…"`.
  const re = new RegExp(`\\b${escapeRegExp(old)}\\b`, "g");
  const next = store.lines
    .map((line) => {
      const depth = 0;
      let result = "";
      let i = 0;
      while (i < line.length) {
        const ch = line[i];
        if (ch === "#") {
          result += line.slice(i);
          break;
        }
        if (ch === '"') {
          // copy the whole string literal verbatim
          const start = i;
          i++;
          while (i < line.length && line[i] !== '"') {
            if (line[i] === "\\") i++;
            i++;
          }
          i++;
          result += line.slice(start, i);
          continue;
        }
        result += ch;
        i++;
      }
      // Now apply rename to the non-string, non-comment prefix and re-glue.
      const codePart = result;
      const tail = line.slice(codePart.length);
      const renamed = codePart.replace(re, newName);
      void depth;
      return renamed + tail;
    })
    .join("\n");
  const original = store.source;
  writeFileSync(path, next);
  const v = validate(path);
  if (!v.ok) {
    writeFileSync(path, original);
    throw new Error(`rename rejected: ${v.message}`);
  }
  logOp(path, { op: "rename", layer: entry.layer, name: old, newName });
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assemble(layer: string, name: string, body: string): string {
  // Each layer has its canonical opener. Keep this regenerable from the AST
  // later; for the PoC we lean on tiny templates.
  switch (layer) {
    case "type":
      return `type ${name} = ${body}`;
    case "slot":
      return `slot ${name} : ${body}`;
    case "effect":
      return `effect ${name} ${body}`;
    case "reducer":
      return `reducer ${name} ${body}`;
    case "tile":
      return `tile ${name} = ${body}`;
    case "fn":
      return `fn ${name}${body.startsWith("(") ? "" : " "}${body}`;
    case "app":
      return `app ${name}\n${body}`;
    case "theme":
      return `theme ${name} = ${body}`;
    default:
      throw new Error(`Unknown layer "${layer}"`);
  }
}
