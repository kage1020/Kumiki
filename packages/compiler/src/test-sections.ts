import { type Expr, isTileExpr, type TestDef, type TileExpr } from "./ast.ts";

/**
 * The section vocabulary of a test body, per test kind (spec §8.1.1).
 *
 * A test body is a schema, and its sections are read by name: the lowering asks
 * a `given` for `slots`, for `event`, for `mocks`, and an `expect` for what that
 * kind asserts. A name outside the set was dropped — nothing read it, and
 * nothing reported it — so the section the author wrote simply did not happen:
 *
 *     given  = {slot: {count: 41}, event: {type: ui.click, target: B}}
 *     expect = {slots: {count: 1}, effects: []}
 *
 * passes, because `count` starts at its declared default and the 41 is never
 * set. The test asserts the reducer against a state nobody chose.
 *
 * Each entry maps a canonical section name to the other spellings the lowering
 * also reads. Only `episode-test`'s `expect` has any: `episodeExpectJs` has
 * always accepted the camelCase forms alongside the hyphenated ones the spec
 * writes, so they are accepted here too rather than becoming a diagnostic for
 * something codegen still lowers. The canonical name is the one a message
 * offers.
 *
 * An empty part is one with no sections at all: a `tile-test`'s `expect` is a
 * tile expression, a `property-test` asserts through its `invariant` clause,
 * and an `episode-test`'s given is the log it loads. The type of a section name
 * is derived from this table (see `GivenSection` / `ExpectSection`), so the
 * accessors below cannot name a section it does not list — which is what keeps
 * `codegen/emit-test.ts` and the checker reading one vocabulary.
 */
export const TEST_SECTIONS = {
  "reducer-test": {
    given: { slots: [], event: [], mocks: [] },
    expect: { slots: [], effects: [], panic: [] },
  },
  "tile-test": {
    given: { slots: [], in: [] },
    expect: {},
  },
  "property-test": {
    given: { slots: [], event: [] },
    expect: {},
  },
  "episode-test": {
    given: {},
    expect: {
      "slots-equal": ["slotsEqual"],
      "no-panics": ["noPanics"],
      "no-errors": ["noErrors"],
    },
  },
} as const satisfies Record<string, Record<TestPart, Record<string, readonly string[]>>>;

/** The two clauses whose value is a record of sections. */
export type TestPart = "given" | "expect";

export type TestKind = keyof typeof TEST_SECTIONS;

/** The sections a kind's `given` accepts — `never` for a kind that has none. */
export type GivenSection<K extends TestKind> = keyof (typeof TEST_SECTIONS)[K]["given"] & string;

/** The sections a kind's `expect` accepts — `never` for a kind that has none. */
export type ExpectSection<K extends TestKind> = keyof (typeof TEST_SECTIONS)[K]["expect"] & string;

type PartTable = Record<string, readonly string[]>;

function partTable(kind: TestKind, part: TestPart): PartTable {
  return TEST_SECTIONS[kind][part] as PartTable;
}

/** The fields of `e` when it is a record literal, and none when it is not. */
function fieldsOf(e: Expr | TileExpr | undefined): { name: string; value: Expr }[] {
  if (e === undefined || isTileExpr(e) || e.kind !== "RecordLit") return [];
  return e.fields;
}

/**
 * The canonical name `written` spells, or `undefined` when the kind's part has
 * no such section. This is the checker's half of the table: it answers for a
 * name read off the source, where the accessors below answer for one the
 * compiler wrote.
 */
export function canonicalSection(
  kind: TestKind,
  part: TestPart,
  written: string,
): string | undefined {
  const table = partTable(kind, part);
  if (Object.hasOwn(table, written)) return written;
  for (const [name, aliases] of Object.entries(table)) {
    if (aliases.includes(written)) return name;
  }
  return undefined;
}

/** The canonical names a kind's part accepts, in the order the table lists them. */
export function sectionNames(kind: TestKind, part: TestPart): string[] {
  return Object.keys(partTable(kind, part));
}

/**
 * The value of one section of a test's `given`, or `undefined` when the test
 * does not write it. `kind` is passed rather than read off `t` because
 * `TestDef` is not discriminated by it: passing the literal is what ties the
 * `name` argument to the table, so a section this file does not list is a type
 * error at the call site rather than a silent `undefined` at run time.
 */
export function givenSection<K extends TestKind>(
  t: TestDef,
  kind: K,
  name: GivenSection<K>,
): Expr | undefined {
  return sectionValue(t.given, kind, "given", name);
}

/** The value of one section of a test's `expect`. See `givenSection`. */
export function expectSection<K extends TestKind>(
  t: TestDef,
  kind: K,
  name: ExpectSection<K>,
): Expr | undefined {
  return sectionValue(t.expect, kind, "expect", name);
}

function sectionValue(
  body: Expr | TileExpr | undefined,
  kind: TestKind,
  part: TestPart,
  name: string,
): Expr | undefined {
  for (const f of fieldsOf(body)) {
    if (canonicalSection(kind, part, f.name) === name) return f.value;
  }
  return undefined;
}

/**
 * The accepted name `written` most likely meant, or `undefined` when it is
 * close to none of them — a suggestion that is not the word the author meant
 * sends the repair at the wrong name.
 *
 * A candidate qualifies on the threshold every name-suggest branch uses (≤ 2
 * edits, or ≤ 25% of the written name's length), or on being an abbreviation
 * of one: `slots-eq` is three edits from `slots-equal`, which no distance rule
 * this tight reaches, and `input` is three from `in`. The prefix rule is safe
 * here in a way it would not be over a program's names, because the candidates
 * are a closed set of three or four words fixed by the language.
 */
export function nearestSection(
  kind: TestKind,
  part: TestPart,
  written: string,
): string | undefined {
  let best: string | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const name of sectionNames(kind, part)) {
    const d = levenshtein(written, name);
    const abbreviates =
      Math.min(written.length, name.length) >= 2 &&
      (name.startsWith(written) || written.startsWith(name));
    if (!abbreviates && d > 2 && d > Math.ceil(written.length * 0.25)) continue;
    if (d < bestScore) {
      bestScore = d;
      best = name;
    }
  }
  return best;
}

function levenshtein(a: string, b: string): number {
  const n = b.length;
  // Rolling single-row DP — `prev` holds the previous row's distances.
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i, ...new Array<number>(n).fill(0)];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min((prev[j] ?? 0) + 1, (curr[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
    }
    prev = curr;
  }
  return prev[n] ?? 0;
}
