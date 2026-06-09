# Learning-Cost Benchmark — cross-vendor re-take (current implementation)

The four learning-cost tasks measure how accurately an LLM, given **only the
Kumiki spec + the task spec**, can write a `.kumiki` program that **parses,
typechecks, and builds**, in a **single pass**. LOC / token counts are recorded
for token-efficiency.

The committed `results/*/eval.json` were generated in the old **"Strand"** era
(pre-rename, an earlier compiler). This re-take refreshes them against the
current toolchain (`main`, v0.6-era) across three vendors **under one protocol**.

## Protocol (uniform — single pass, spec only)

- **Inputs**: each version's `task-spec.md` + `docs/spec/*.md` only. The worked
  example apps under `packages/examples/apps/` (esp. `04-issue-tracker`,
  `05-project-management`, which mirror v3/v4) were **off-limits** — reading them
  is copying the answer, not measuring learning cost.
- **Single pass**: write from spec once; **no `check`/`build`/`smoke` loop**, no
  scratch compiles. The author never sees a compiler error before submitting.
  Verification (the table below) is run *afterward* by the harness.
- **Claude** — Opus 4.8, each task written by a **fresh isolated sub-agent** with
  no prior session context (see "Fairness note").
- **Codex** — `codex exec --full-auto` (v0.125).
- **Gemini** — `agy --print` (antigravity-cli), run in an isolated temp workspace
  (spec + task-spec only). agy writes to its SQLite conversation store, not
  stdout; outputs were extracted from there.

## Results

| Task | Vendor | LOC | chars | cl100k | parse | typecheck | build | first error |
|---|---|---:|---:|---:|:--:|:--:|:--:|---|
| v1 Pomodoro | Claude | 59 | 1,347 | 384 | ✅ | ✅ | ✅ | — |
| v2 Kanban | Claude | 178 | 5,291 | 1,421 | ✅ | ✅ | ✅ | — |
| v2 Kanban | Codex | 243 | 6,517 | 1,881 | ✅ | ✅ | ✅ | — |
| v2 Kanban | Gemini | 152 | 4,591 | 1,314 | ✅ | ✅ | ✅ | — |
| v3 Issue Tracker | Claude | 629 | 23,915 | 5,325 | ✅ | ✅ | ✅ | — |
| v3 Issue Tracker | Codex | 674 | 23,210 | 6,417 | ✅ | ✅ | ❌ | build: `Tile "error" not found` |
| v3 Issue Tracker | Gemini | 440 | 20,270 | 4,995 | ✅ | ❌ | ❌ | typecheck E0103: undefined `$1` (×23) |
| v4 Project Mgmt | Claude | 1029 | 39,178 | 9,552 | ❌ | ❌ | ❌ | parse @201:20 `Expected a definition keyword` |
| v4 Project Mgmt | Codex | 877 | 32,376 | 8,703 | ✅ | ✅ | ❌ | build: `Tile "error" not found` |
| v4 Project Mgmt | Gemini | 294 | 16,517 | 4,397 | ❌ | ❌ | ❌ | parse @152:50 `Expected op(:)` |

### Reading the table

- **Build-green, single pass**: Claude 3/4 (v1–v3), Codex 1/3, Gemini 1/3.
  Claude leads but is **not** flawless — v4 parse-fails.
- **No vendor builds v4 in one pass.** The ~800–1500 LOC Project Management task
  is beyond reliable single-pass authoring for every current model. Notably,
  **Codex's v4 typechecks** and fails only on the `error`-tile codegen gap
  ([#61](https://github.com/kage1020/Kumiki/issues/61)) — if that were fixed,
  Codex's v4 would plausibly build, making it the strongest at v4.
- **Token efficiency** (v2, the one task all three build): Gemini 1,314 <
  Claude 1,421 < Codex 1,881 tokens.
- **Degradation with scale**: Gemini builds v2 → typecheck-fails v3 → parse-fails
  v4. Claude holds through v3 then parse-fails v4. Codex typechecks through v4.

## Fairness note (why this is a re-take of the re-take)

The **first** Claude column reported 4/4 builds. That was **not a fair
measurement** and was discarded: it was written inline by the main session,
which had (a) read the full spec carefully up front, (b) run small "is this
syntax legal?" probe-compiles before writing (a check loop the vendors were
forbidden), and (c) accumulated compiler-specific knowledge earlier in the
session. Re-running Claude as **fresh isolated sub-agents under the same
single-pass, no-check, spec-only protocol as Codex/Gemini** drops it to **3/4**
(v4 parse-fails) — consistent with the vendors struggling at v4 scale.

## Compiler gap surfaced by the benchmark → issue #61

Codex's v3 and v4 fail `build` on `Tile "error" not found`. The `error` tile
(and `code`/`video`/`list`/`table`/`modal`/`drawer`/`tooltip`/`popover`/`toast`/
`progress`) is documented in `docs/spec/stdlib.md §2.3` and accepted by `check`,
but is missing from codegen's `BUILTIN_TILES` — accept-then-crash-at-build.
Tracked in [#61](https://github.com/kage1020/Kumiki/issues/61).

## Notes

- **v1 S1/S2/S3** (zero/one/few-shot) are not reproduced — they measure a
  cold-context single pass under different prompting strategies that an
  interactive agent cannot honestly simulate. v1 has no vendor columns.
- **agy quirks**: writes answers to `~/.gemini/antigravity-cli/conversations/*.db`
  (not stdout); large outputs truncate at the default 5-minute `--print-timeout`;
  runs are non-deterministic (v4 took 3 attempts). Prompts:
  `learning-cost/v{2,3,4}-*/gemini-prompt.txt`.
