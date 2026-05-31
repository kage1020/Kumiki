# Learning Cost Benchmark v4 — 800-1500 LOC Large-Scale Task + Full-Feature Browser Operation

English · [日本語](./learning-cost-v4.ja.md)

A sequel to [v1](./learning-cost-v1.md) (Pomodoro), [v2](./learning-cost-v2.md) (Kanban), and [v3](./learning-cost-v3.md) (Issue Tracker, 727 LOC). We measure the AI's practical upper limit with **the largest-scale** Project Management Tool in Strand v0.1.

## Purpose

In v3 we achieved one-shot writing of the Issue Tracker (727 LOC) + full-feature browser operation. Remaining questions:

1. **The 1000+ LOC wall**: at even larger scale, does LLM hallucination / structural breakdown occur?
2. **Deep hierarchy**: can the 4-level hierarchy of Projects → Tasks → SubTasks → Comments, multiple views (List/Board), and multiple forms be integrated?
3. **Composite features**: do Board view (per-status columns) / filters / due date / theme all work together in one shot?

v4 verifies with a **Project Management Tool** (Asana / Linear-like, 5 routes, 20+ reducers, List/Board switching, subtasks, due date).

## Task

`benchmarks/learning-cost-v4/task-spec.md` — PM Tool SPA:
- 5 routes (`/`, `/projects/:id`, `/projects/:id/tasks/:taskId`, `/projects/:id/new-task`, `/settings`)
- 20+ reducers (Project CRUD / Task CRUD / status / priority / assignee / dueDate editing / tag / comment / filter / view switching / theme)
- List view ⇄ Board view (4 status columns)
- the hierarchy of Projects → Tasks (subtasks via parentTaskId) → Comments
- localStorage persistence (projects / tasks / comments)
- Light / Dark theme

## Results

| Condition | LOC | parse | typecheck | build | Full-feature browser operation |
|---|---:|:-:|:-:|:-:|:-:|
| P-Claude | 1255 | ✓ | ✗ | — | — |
| **P-Codex (gpt-5.5)** | **1309** | **✓** | **✓** | **✓** | **✓ (all features work)** |
| P-Gemini | 606 | ✗ | — | — | — |

### Largest one-shot pass (P-Codex, 1309 LOC)

**The largest one-shot pass measured to date.** OpenAI gpt-5.5 passed parse/typecheck/build of a 1300+ LOC PM Tool in one-shot writing. After the runtime fixes described below, all features work in the browser:
- Project creation / archive / deletion
- Task creation / status / priority / assignee / due date editing / tag / comment / subtask
- **List view ⇄ Board view switching** (Board is 4 status columns)
- **filters** (status / priority / assignee / search, also effective on Board)
- due date setting (Overdue/Today/Soon/Upcoming determination)
- Light/Dark theme switching / localStorage persistence

### P-Claude (1255 LOC) — 1-write violation at typecheck

P-Claude wrote the most comprehensively, but in the `deleteTask` reducer:
```strand
tasks := tasks.remove(tid)
tasks := tasks.filter(taskNotChildOf($2, tid))   # ← E0601 on the 2nd write to the same path
```
This is a violation of Strand's **1-reducer-1-write constraint** (path-shape granularity, [Language Core](../spec/language.md) §1.6.4). Chaining as `tasks := tasks.remove(tid).filter(...)` passes within 1-write. With agent-loop it is within self-recovery range, but in one-shot writing it violated. This is a **reject as the specification intends**, not an implementation bug.

### P-Gemini (606 LOC) — tuple argument to a tile

Gemini was the most concise, but passed a **tuple literal argument to a tile** as in `StatusColumn((p.id, Backlog))`. Strand's tile arguments are a single value, and tuple literals are unsupported. It brought in out-of-spec syntax. In the spec, a record argument `{projectId: ..., status: ...}` should be used (P-Codex wrote it correctly in this form).

## Specification ↔ Implementation Divergences Revealed by Browser Operation Verification (7 in v4)

Revealed and fixed in the process of running P-Codex's code on real devices:

| # | Fix | Detection scenario |
|---|---|---|
| 31 | convert the `Duration.h/m/s/ms/d` constructor to ms | `now.plus(Duration.h(72))` |
| 32 | `Time.plus / .minus / .diff` methods (ms arithmetic) | `now.plus(...)` |
| 33 | Option dispatch for `.flat-map` (`flatMapOption`) | `routeProjectId(r).flat-map(ps.get($1))` |
| 34 | make `.map` List/Option polymorphic (`mapOver`) | `option.map(...)` / `list.map(...)` |
| 35 | unify `.entries` tuple destructure for `.filter` / `.map` | `ts.entries.filter($2.projectId == ...)` |
| 36 | **DOM-path focus restoration** for input/textarea (even without bind/id) | focus drops off on a `value=`-only search box |
| 37 | **recurse select's valueKey down to the payload** (variant collision avoidance) | `Option(Status)`'s `Some(Backlog)` / `Some(InProgress)` all collide as `_tag:"Some"` and get fixed to the "last option" |
| 38 | value context for the if in a named arg (`text=if c then ... else ...`) | `button(text=if viewMode == ListView then "Board" else "List")` |

In particular, **#37 (valueKey's variant collision)** surfaced for the first time in v4 by making `Option(Variant)` a select value. With a flat `_tag` comparison, `Some(A)` and `Some(B)` cannot be distinguished, a UX bug where the last option is always selected.

## Implications

### gpt-5.5 one-shot writes 1300 LOC

In v3 Claude was the winner at 727 LOC, but in v4 **gpt-5.5 (Codex) is the only full pass at 1309 LOC**. The scale band a model is good at differs by model:
- **Claude**: high applicative power for the specification, but pushes too far and hits the 1-write constraint
- **gpt-5.5**: defensive and verbose but robust at large scale. The caution to choose spec-compliant record arguments
- **Gemini**: concise but with the risk of mixing in other-language syntax (tuple arguments, `let..in`)

### Verifying "it works" tests the language's coverage

In v4 too, 7 runtime gaps surfaced in the browser after passing parse/typecheck/build. These are **"paths exercised for the first time when using deeper features"**:
- making `Option(Variant)` a select value (valueKey collision)
- `Duration` arithmetic (due date)
- chaining Option with `.flat-map`
- focus on a bind-less `value=` search box

These are routes never trodden in small-scale apps, reconfirming the v3 insight that **large-scale apps test the language implementation's coverage**.

## Cumulative Summary (v1–v4)

The Strand implementation gaps detected and fixed across 4 rounds of learning cost verification total **38**:

| Scope | Cumulative count |
|---|---:|
| Parser | 11 |
| Typecheck | 2 |
| Codegen | 17 |
| Runtime | 8 |

After fixing all, 71 tests pass + full operation of the 4 apps Pomodoro / Kanban / Issue Tracker / **PM Tool (1309 LOC)**.

## Conclusion

| Verification item | Result |
|---|---|
| **The 1000+ LOC wall** | ✓ gpt-5.5 fully passed 1309 LOC in one-shot writing |
| **Deep hierarchy (Project→Task→SubTask→Comment)** | ✓ browser operation confirmed |
| **Composite features (List/Board + filter + due date + theme)** | ✓ all features work |
| **Dynamic consistency** | △ 7 additional gaps in v4 → all fixed |
| **Fundamental defect of the language specification** | **none**. All detected cases were filled in as implementation gaps |

**Conclusion**: Strand v0.1 reached a level where the AI gets a 1300 LOC-class practical SaaS-equivalent SPA working in one-shot writing. Medium-scale business apps (project management / ticket management / admin screens) have entirely entered the range of AI one-shot writing.

## Reproduction

```bash
node benchmarks/scripts/learning-cost-eval.mjs \
  benchmarks/learning-cost-v4/results/P-Claude/output.strand \
  benchmarks/learning-cost-v4/results/P-Codex/output.strand \
  benchmarks/learning-cost-v4/results/P-Gemini/output.strand

pnpm --filter @strand/cli exec tsx src/strand.ts build \
  benchmarks/learning-cost-v4/results/P-Codex/output.strand \
  out/pm-tool
node benchmarks/scripts/serve.mjs out/pm-tool 5193 &
# → http://localhost:5193/
```
