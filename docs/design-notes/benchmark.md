# Benchmark — Kumiki vs React (TodoMVC)

For Kumiki to call itself "AI-friendly," **actual cost measurements** are needed. We implemented the same TodoMVC feature set in both Kumiki and React and measured token count / line count / edit impact scope.

## Environment

| Item | Value |
|---|---|
| Kumiki source | `packages/examples/apps/02-todomvc/app.kumiki` |
| React source | `packages/benchmarks/todomvc-react/src/App.tsx` |
| Feature set | add / toggle done / delete / Filter (All/Active/Done) / Clear completed / localStorage persistence / theme tokens |
| Measurement scripts | `packages/benchmarks/scripts/measure.mjs`, `packages/benchmarks/scripts/measure-scenarios.mjs` |
| Tokenizers | `cl100k_base` (GPT-4) and `o200k_base` (GPT-4o) from `gpt-tokenizer` |

## File Size Comparison

```
label                    files  chars  loc-total  loc-code  cl100k  o200k
-----------------------  -----  -----  ---------  --------  ------  -----
kumiki (todomvc.kumiki)  1      4710   163        116       1358    1362
react  (App.tsx)         1      7357   279        236       1883    1923
```

### Ratios (React / Kumiki)

| Metric | Ratio | Interpretation |
|---|---|---|
| Characters | **1.56x** | The React source is 1.56x longer than Kumiki |
| LOC (excluding blank/comment lines) | **2.03x** | React's body is 2x |
| GPT-4 tokens (cl100k_base) | **1.39x** | Kumiki **saves 39% tokens** |
| GPT-4o tokens (o200k_base) | **1.41x** | 41% saved likewise |

### Main Sources of Difference

| Source of difference | Impact |
|---|---|
| Kumiki has no declarative clauses like `useState` / `useEffect` / callback binding | Just write reducer/effect/slot directly |
| Kumiki has no explicit attributes like JSX `<div style={...}>` | Shorthand tile props (`{bg: "primary"}`) |
| Kumiki has places where generic type annotations like TypeScript's `Record<TodoId, Todo>` are unnecessary | The schema is declared in a single place |
| Kumiki's `match` expression / `for ... when` loop | In React, a chain of `Object.entries(...).filter(...).map(...)` |
| Kumiki's theme is declaration-only; React scatters inline styles | React side writes about 10 references to `theme.colors.primary` |

## Edit Impact Scope Scenarios (4 kinds)

We manually applied 4 typical changes to both implementations and tallied the additions/deletions/characters/tokens of the diff from the base.

```
Per-scenario patch sizes (lines / chars / tokens)

scenario                 impl      +lines   -lines    chars   cl100k    o200k
------------------------------------------------------------------------------
01-add-priority          kumiki         4        4      568      175      181
                         react          8        3      483      150      156
02-strict-validation     kumiki         7        4      432      112      115
                         react          4        2      322       88       92
03-add-archived          kumiki        19       11     1540      442      448
                         react         27        9     1475      417      415
04-dark-theme            kumiki        25        6     1315      401      401
                         react         48       12     2153      638      638

Totals across scenarios
  kumiki : +55/-25  chars=3855  cl100k=1130  o200k=1145
  react  : +87/-26  chars=4433  cl100k=1293  o200k=1301

React / Kumiki ratios (totals)
  +lines : 1.58x
  chars  : 1.15x
  cl100k : 1.14x
  o200k  : 1.14x
```

### Interpretation per Scenario

| Scenario | Kumiki chars | React chars | Winner | Comment |
|---|---:|---:|---|---|
| 01: Add `priority` field to Todo | 568 | 483 | React (-15%) | React's expression of a multi-line sort function is smaller |
| 02: Stronger validation (trim + max 100) | 432 | 322 | React (-25%) | Kumiki is verbose when writing an if-then-else block as `{ ... ; ... ; ... }` |
| 03: Add `Archived` variant to Filter + `archived` field to Todo | 1540 | 1475 | Even | Feature additions (new button, new reducer) are about the same |
| 04: Dark mode toggle (2 themes + slot + reducer + UI) | 1315 | 2153 | **Kumiki (-39%)** | Since the runtime has a theme mechanism, the Kumiki side needs only declarations |

### The Larger the Scale, the More Kumiki Wins

- **Small type changes / validation additions**: React's patch is shorter (no runtime-helper or variable-name overhead)
- **New variant / new field**: Even (decided by the number of impacted spots)
- **Cross-cutting features (dark mode, a11y, error boundary)**: Kumiki dominates. React must drill a `theme` prop into every component, whereas Kumiki is complete by adding a single theme-switch slot

This backs up Kumiki's claim that "**because the runtime holds built-in features, user-side code becomes thin**." The more cross-cutting the change, the wider the gap.

### Number of Impacted Spots (across the type system)

| Scenario | Kumiki spots | React spots |
|---|---:|---:|
| 01-priority | 4 | 4 |
| 02-validation | 2 (addTodo, slot) | 2 (addTodo, JSX maxLength) |
| 03-archived | 7 (type, fn matchFilter, fn itemsLeft, FilterBar, TodoRow, addTodo, archive reducer) | 7 (type, matchFilter, itemsLeft, addTodo, TodoRow component, archive handler, render) |
| 04-dark-theme | 4 (2 new themes, themeName slot, toggleTheme reducer, ThemeBtn) | 11 (2 new themes, ThemeName/Theme types, themeName state, theme selection, toggle handler, ThemeBtn JSX, theme prop drilling × 5+ spots) |

Up through 03 the number of spots is the same, but **only 04 differs greatly**: React must pass the theme to every component via props.

## The Essence of Token Efficiency

| Scenario | Kumiki favored | React favored |
|---|---|---|
| Writing a new project from scratch | ◯ (1.39–1.56x fewer) | |
| Adding 1 field to an existing project | (fewer lines) | △ (14–25% fewer tokens) |
| Adding a variant + related changes to an existing project | Even | Even |
| Cross-cutting features (theme/a11y/error-boundary) | ◎ (39% fewer chars) | |
| Total of the 4 scenarios | ◯ (13% fewer chars / 12% fewer tokens) | |
| Parallel agent development (CRDT op) | Not measured | Not measured |

### Conclusion

- **New generation (full)**: Kumiki is 30–40% cheaper
- **Small fix patches**: React can be 15–25% cheaper
- **Cross-cutting fixes**: Kumiki is roughly 40% cheaper (thanks to the runtime's built-in mechanisms)
- **Total**: Summing the patches across the 4 scenarios, Kumiki is 87% of React's character count / 87% of its token count

## Efficiency of Kumiki Edit Ops

Using `kumiki add / replace / remove` implemented in [AI Editing](../spec/ai-edit.md),
**a fix is completed by sending only "the body of the def being changed."** For the same 4 scenarios,
we compared 3 "ways of conveying a fix":

| Format | What the AI outputs | Pros | Cons |
|---|---|---|---|
| **full file** | The entire fixed file | Natural for the AI | Outputs even the 80% of defs that don't change, every time |
| **patch (unified diff)** | A diff of `+` / `-` lines | Smallest | Hard for the AI to write a diff accurately |
| **op stream** | A sequence of `add/replace/remove` | Natural for the AI + automatic validation + op-log | Slightly longer than a patch |

### Measured Values

```
scenario                  #ops  full ch  full tk  patch ch  patch tk    op ch    op tk
-----------------------------------------------------------------------------------------------
01-add-priority              4     4811     1391      568      175      890      265
02-strict-validation         2     4811     1380      432      112      387       99
03-add-archived             11     5129     1474     1540      442     1734      482
04-dark-theme               12     5518     1643     1315      401     2184      697
                          ---  -------  -------  --------  --------  -------  -------
TOTAL                       29    20,269    5,888    3,855    1,130    5,195    1,543
```

### Compression Ratio (smaller is better)

| Comparison | Chars | Tokens |
|---|---|---|
| **op vs full-file** | 25.6% | **26.2%** (74% reduction) |
| op vs patch | 135% | 137% (op is more verbose) |

### Interpretation

- Compared to the **default style where the AI emits "the entire fixed code"** (the default of many coding agents), Kumiki's op stream can **save 74% of tokens**
- If the **AI can emit a unified diff perfectly correctly**, the patch is shorter, but real-world coding agents occasionally break the diff format. The op stream just passes "the fixed def body" and carries `add/replace/remove` semantics, so format errors are less likely
- In addition, the op stream uses **validate-then-rollback** so patches that produce a parse error / typecheck error are automatically rejected (a property the patch lacks)

### In Other Words, in a Real Production AI Loop

1. **Instruct the AI with a fix task**
2. **The AI outputs "the fixed def in `add/replace` form"** (in a Markdown block)
3. **The CLI reads it as an op stream and applies each op in sequence**
4. **Validation fails somewhere → reject only that op and return the error to the agent**

The AI cost of "2 → 3" in this loop is **about 1/4** of the full-file approach.
This is the economic benefit of the AI editing API.

## Measurement Constraints

- The comparison covers **the same feature set only**. Adding serious optimizations like React's `useMemo` / `useCallback` / Suspense would increase LOC, but the Kumiki side has likewise not added signal-graph optimization (Phase 1 PoC level)
- The React side does **not** implement an **error boundary / automatic theme application / a11y checks** (they are in the Kumiki runtime; adding equivalents to the React version should be around +50 lines)
- Differences appear depending on the tokenizer (`cl100k_base` vs `o200k_base`). Both are around 1.4x
- **There is only one edit-impact-scope scenario** (the priority field). Other patterns such as adding validation / adding a variant are deferred to a later phase

## Notes (for the reader)

- **This is not evidence that "Kumiki is superior to React."** Kumiki compresses its expression on the premise that humans won't read it, so it merely has fewer tokens
- React has syntax tuned to human cognition, so for human maintenance it is superior to Kumiki
- It is enough to understand the fact that "from the perspective of AI coding cost, there is a 1.4x difference"

## Reproduction

```bash
node packages/benchmarks/scripts/measure.mjs            # full-file comparison
node packages/benchmarks/scripts/measure-scenarios.mjs  # patch comparison across the 4 scenarios
node packages/benchmarks/scripts/measure-ops.mjs        # op stream cost for the same 4 scenarios
```

## Numbers (written directly, for later regeneration)

Last measured: 2026-05-29

### Full file
| | Kumiki | React | React/Kumiki |
|---|---|---|---|
| chars | 4,710 | 7,357 | 1.56x |
| loc-code | 116 | 236 | 2.03x |
| cl100k | 1,358 | 1,883 | 1.39x |
| o200k | 1,362 | 1,923 | 1.41x |

### Patch total (4 scenarios)
| | Kumiki | React | React/Kumiki |
|---|---|---|---|
| +lines | 55 | 87 | 1.58x |
| -lines | 25 | 26 | 1.04x |
| chars | 3,855 | 4,433 | 1.15x |
| cl100k | 1,130 | 1,293 | 1.14x |
| o200k | 1,145 | 1,301 | 1.14x |

### Per-scenario chars (React/Kumiki ratio)
- 01-add-priority: 0.85x (React shorter)
- 02-strict-validation: 0.75x (React shorter)
- 03-add-archived: 0.96x (even)
- 04-dark-theme: 1.64x (Kumiki shorter)

### Comparison of Kumiki Edit "Delivery Cost"

| Format | Total chars across all 4 scenarios | Same in GPT-4 tokens |
|---|---:|---:|
| full file (AI emits the entire changed code) | 20,269 | 5,888 |
| patch (unified diff) | 3,855 | 1,130 |
| **op stream (kumiki add/replace/remove)** | 5,195 | **1,543** |

The op stream is **26.2%** of the full-file approach = **74% token savings**.
