# Learning Cost Benchmark v3 — 500+ LOC Large-Scale Task + Browser Actual Operation

English · [日本語](./learning-cost-v3.ja.md)

A sequel to `./learning-cost-v1.md` (Pomodoro / Claude / 4 conditions) and `./learning-cost-v2.md` (Kanban / 3 vendors). We demonstrate the LLM's practical range with an **even larger Issue Tracker SPA**.

## Purpose

In v2 we confirmed "**one-shot-write success of Kanban (200 LOC) with 3 vendors + browser actual operation**." Remaining doubts:

1. **Scale limit**: at 200 LOC, LLM hallucination is low frequency. Does it increase exponentially at 500+ LOC?
2. **Complex features**: does one-shot writing hold for a practical app integrating multiple routes / filters / persistence / theme switching?
3. **Dynamic execution**: even passing parse/typecheck/build, whether **all features work in the browser** is the true evaluation

v3 verifies (1)(2)(3) with an **Issue Tracker SPA** (GitHub Issues-like, 4 routes, card operations + filters + tags + comment + localStorage + theme).

## Task

`benchmarks/learning-cost-v3/task-spec.md` — Issue Tracker SPA:
- 4 routes (`/`, `/issues/:id`, `/new`, `/settings`)
- 9 reducers (create / updateStatus / updatePriority / updateAssignee / addTag / removeTag / addComment / deleteComment / deleteIssue)
- narrowing by status / priority / search via the FilterState slot
- localStorage persistence (issues + comments)
- Light/Dark theme switching

## Conditions

| ID | LLM | Provider | Path |
|---|---|---|---|
| I-Claude | Claude | Anthropic | Claude Code Agent tool |
| I-Codex  | gpt-5.5 | OpenAI    | `codex exec --sandbox workspace-write` |
| I-Gemini | Gemini  | Google    | Gemini CLI (`--print`) |

Experiment rule: one-shot write, self-loop forbidden. Free reference to specification docs + 3 examples.

## Results

| Condition | LOC | parse | typecheck | build | Browser actual operation |
|---|---:|:-:|:-:|:-:|:-:|
| **I-Claude** | **727** | **✓** | **✓** | **✓** | **✓ (all features work)** |
| I-Codex   | 1058 | ✓ | ✓ | ✗ | n/a |
| I-Gemini  | 501  | ✗ | ✗ | ✗ | n/a |

### Largest one-shot pass (I-Claude, 727 LOC)

- **Fully passed one-shot writing at 727 LOC** (1.45x the specification, 11x the scale of Pomodoro)
- After the additional specification/implementation fixes described below, **all features work in the browser**:
  - Issue creation / detail display / dropdown editing of Status/Priority/Assignee
  - tag add/remove / comment add/remove / individual issue deletion
  - localStorage persistence / Light/Dark theme switch
  - filtering (status / priority / search) / sorting

### I-Codex (1058 LOC) — Passed Through typecheck

I-Codex wrote up to 1058 LOC beyond the spec scope (over-generation of defensive helpers). It wrote `.copy(field=value)` etc. correctly, but at the build stage it chained into using **nonexistent HTML-derived builtins** (`fieldset`/`error`/`alert`/...). Only `fieldset` was absorbed in the implementation, but build failed because the other hallucinations chained.

### I-Gemini (501 LOC) — parse Failure

It brought in the OCaml/Haskell-derived `let x = y in z` expression syntax, which the Kumiki parser cannot parse. Gemini was able to write a structurally correct design (separation of types/fns/effects/tiles, 4-route integration), but other-language knowledge mixed in syntactically.

## Specification ↔ Implementation Divergences Revealed by Browser Operation Verification (19 in v3)

In the process of running I-Claude with `kumiki build` + static serve + Chrome, initially **numerous runtime errors occurred in the browser after build**. All were mismatches / coverage gaps between Kumiki's specification docs and implementation, so we fixed them.

### Parser Extensions

| # | Fix | Detection scenario |
|---|---|---|
| 12 | `.copy(field=value, ...)` named-arg syntax | I-Codex `issue.copy(status=s, updatedAt=t)` |
| 13 | dispatch `if` within a tile-arg by value/tile context | I-Codex `if isEmpty(...) then EmptyTags else row(for tag in ...)` |
| 14 | bool OR vs match arm separator heuristic for `\|` | I-Gemini `a.contains(x) \| b.contains(x)` |
| 15 | make 1-reducer-1-write **path-shape granularity** | I-Claude `issues[iid].status := s; issues[iid].updatedAt := now` |

### Codegen Extensions

| # | Fix | Detection scenario |
|---|---|---|
| 16 | implemented `select` / `radio` codegen | in spec but unimplemented |
| 17 | `fieldset` builtin | absorbing I-Codex hallucination |
| 18 | make `.filter` List/Map polymorphic dispatch (`_s.filter`) | mistakenly mapFilter on `m.keys.filter(...)` |
| 19 | `[k,v]` tuple destructure for the lambda of list ops (`map`/`filter`/`sort-by`/`find`) | `m.entries.sort-by($2.x).map($1)` |
| 20 | Option / Map dispatch for `.get-or(default)` | `routeIssueId(route).get-or(IssueId.fresh())` |
| 21 | FieldAccess no-paren shorthand: `.values` / `.entries` / `.is-empty` / `.lower` / `.upper` / `.trim` / `.unique` / `.reverse` / `.sort` | `tagDraft.trim.is-empty` |
| 22 | MethodCall: `.push` / `.contains` / `.starts-with` / `.ends-with` / `.split` / `.join` / `.reverse` | `tags.push(tagDraft.trim).unique` |
| 23 | nested path for `bind=draft.title` | `extractBindPath` + `_setPathHelper` |
| 24 | `value=` arg for `select` (operation without bind) | `select(value=issues[id].status, ...)` |

### Runtime Extensions

| # | Fix | Detection scenario |
|---|---|---|
| 25 | have `mapEntries` return a `[[k, v], ...]` tuple array | consistency with the destructure lambda |
| 26 | bind path handler for input/textarea/select (`_setPath` via path) | `bind=draft.assignee` |
| 27 | full path identification for focus restoration (`data-kumiki-bind="draft.assignee"`) | the problem where input focus is stolen by title |
| 28 | **implicit onChange dispatch** for select (`ui.change(SelectTile)` reducer) | I-Claude `on=ui.change(StatusSelect)` |
| 29 | dynamic theme: resolve `app.theme = slotName` via `_live[slotName]` | I-Claude `theme = themeName` |
| 30 | re-run `applyThemeDefaults` at the start of `render()` | DOM reflection on theme switch |

## Implications

### "The LLM writes, the human operates" holds

The Issue Tracker is on the scale of **727 LOC, 9 reducers, 4 routes, multiple forms**, and Claude succeeded in one-shot writing without training data, working in the browser. This means:

- The domain of medium-scale business SPAs (internal tools / admin screens) has **entered the scope of AI one-shot writing**
- The 19 fixes revealed by browser actual-operation verification are **all Kumiki implementation gaps**, not fundamental defects of the language specification
- The fixed Kumiki has now reached a shape where equivalent tasks work in one shot going forward

### "Passing parse/typecheck/build ≠ working"

In v3, I-Claude's code that passed parse/typecheck/build in one shot produced **a large number of runtime errors** on its first run in the browser. This is a dimension that did not surface in v1/v2:

- In v1/v2 the apps were small, and only the paths Kumiki's implementation happened to cover were exercised
- For the first time in v3, **features written in the specification docs but unsupported in the implementation**—such as the nested path of `bind=draft.field` / dynamic theme / select's onChange dispatch / `.get-or`'s Option dispatch—all became necessary at once

→ "The LLM can write it" and "it works on real devices" are separate verification stages. **Operation verification tests the language specification's coverage for the first time in v3.**

### Tendencies by LLM

| Vendor | Strength | Weakness |
|---|---|---|
| Claude | meticulously follows the correspondence between specification docs and examples. Infers applications not shown in examples, such as `bind=draft.field` | pushes up to 727 LOC, thus erupting many dynamic problems |
| gpt-5.5 (Codex) | defensive and robust. Does not break down even beyond spec scope | prone to hallucination (`fieldset`/`error` builtins) |
| Gemini | summarizes most concisely and declaratively | high risk of mixing in other-language syntax (`let ... in`) |

## Cumulative Summary (v1 + v2 + v3)

The Kumiki specification gaps detected and fixed across 3 rounds of learning cost verification total **30**:

| Scope | Count |
|---|---:|
| Parser (timer event, multi-stmt block, `&&`/`\|\|` alias, `.copy()`, tile-if dispatch, `\|` bool OR heuristic, etc.) | 9 |
| Typecheck (branch-aware writes, path-shape granularity) | 2 |
| Codegen (select/radio/fieldset/grid/stack/etc., list ops dispatch, no-paren method shorthand, bind path, etc.) | 13 |
| Runtime (timer, null child, path bind handler, focus, dynamic theme, mapEntries tuple, etc.) | 6 |

After fixing all, maintained 71 tests pass + full operation of the 3 apps Pomodoro/Kanban/Issue Tracker.

## Conclusion

| Verification item | Result |
|---|---|
| **Scale resilience (500+ LOC)** | ✓ Claude fully passed 727 LOC in one-shot writing |
| **Complex features (multi-route + persistence + theme + filter + comments)** | ✓ browser operation confirmed |
| **Dynamic consistency (parse+typecheck+build ≠ working)** | △ 19 additional gaps surfaced in v3 → all fixed |
| **By model** | ✓ Claude full operation / △ Codex through typecheck / △ Gemini through parse |
| **Fundamental defect of the language specification** | **none**. All detected cases were filled in as implementation gaps |

**Conclusion**: Kumiki v0.1 reached a level where the AI gets a medium-scale (~700 LOC) practical SPA working in one-shot writing.

## Reproduction

```bash
# Run from the repo root.
# Obtain each LLM's output (same procedure as v2)

# Eval (static)
node benchmarks/scripts/learning-cost-eval.mjs \
  benchmarks/learning-cost-v3/results/I-Claude/output.kumiki \
  benchmarks/learning-cost-v3/results/I-Codex/output.kumiki \
  benchmarks/learning-cost-v3/results/I-Gemini/output.kumiki

# Browser operation verification
pnpm --filter @kumiki/cli exec tsx src/kumiki.ts build \
  benchmarks/learning-cost-v3/results/I-Claude/output.kumiki \
  out/issue-tracker
node benchmarks/scripts/serve.mjs out/issue-tracker 5192 &
# → open http://localhost:5192/ in the browser
```
