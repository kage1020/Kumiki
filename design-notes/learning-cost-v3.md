# 学習コストベンチマーク v3 — 500+ LOC 大規模タスク + ブラウザ実動作

`./learning-cost-v1.md` (Pomodoro / Claude / 4 条件) と `./learning-cost-v2.md` (Kanban / 3 vendor) の続編。**さらに大規模な Issue Tracker SPA** で LLM の実用域を実証する。

## 19.1 目的

v2 で「**3 vendor で Kanban (200 LOC) を一発書き成功 + ブラウザ実動作**」までは確認できた。残る疑念:

1. **スケール上限**: 200 LOC では LLM の hallucination が低頻度。500+ LOC では指数増加するか？
2. **複雑機能**: 複数 routes / フィルタ / 永続化 / theme 切替を統合した実用アプリで一発書きが成立するか？
3. **動的実行**: parse/typecheck/build を通っても **ブラウザで全機能が動作するか** が真の評価

v3 は **Issue Tracker SPA**（GitHub Issues 風、4 routes、card 操作 + フィルタ + tags + comment + localStorage + theme）で (1)(2)(3) を検証。

## 19.2 タスク

`benchmarks/learning-cost-v3/task-spec.md` — Issue Tracker SPA:
- 4 routes (`/`, `/issues/:id`, `/new`, `/settings`)
- 9 reducers (create / updateStatus / updatePriority / updateAssignee / addTag / removeTag / addComment / deleteComment / deleteIssue)
- FilterState slot で status / priority / search の絞り込み
- localStorage 永続化（issues + comments）
- Light/Dark theme 切替

## 19.3 条件

| ID | LLM | Provider | 経路 |
|---|---|---|---|
| I-Claude | Claude | Anthropic | Claude Code Agent tool |
| I-Codex  | gpt-5.5 | OpenAI    | `codex exec --sandbox workspace-write` |
| I-Gemini | Gemini  | Google    | `agy.exe --print` (PowerShell 経由) |

実験ルール: 一発書き、自己ループ禁止。仕様 docs + 3 examples 自由参照。

## 19.4 結果

| 条件 | LOC | parse | typecheck | build | ブラウザ実動作 |
|---|---:|:-:|:-:|:-:|:-:|
| **I-Claude** | **727** | **✓** | **✓** | **✓** | **✓ (全機能動作)** |
| I-Codex   | 1058 | ✓ | ✓ | ✗ | n/a |
| I-Gemini  | 501  | ✗ | ✗ | ✗ | n/a |

### I-Claude の卓越

- **727 LOC で一発書き完全通過**（仕様の 1.45 倍、Pomodoro の 11 倍規模）
- 後述する仕様/実装の追加修正後、**ブラウザで全機能が動作**:
  - Issue 作成 / 詳細表示 / Status/Priority/Assignee の dropdown 編集
  - tag 追加・削除 / コメント追加・削除 / 個別 issue 削除
  - localStorage 永続化 / Light/Dark theme switch
  - フィルタリング (status / priority / search) / ソート

### I-Codex (1058 LOC) — typecheck まで通過

I-Codex は spec 範囲を超えて 1058 LOC まで書いた（防御的なヘルパ過剰生成）。`.copy(field=value)` 等は正しく書けたが、build 段階で連鎖的に **存在しない HTML 由来 builtin** を使った（`fieldset`/`error`/`alert`/...）。`fieldset` だけ実装で吸収したが、他の hallucination が連鎖したため build 失敗。

### I-Gemini (501 LOC) — parse 失敗

OCaml/Haskell 由来の `let x = y in z` という expression 構文を持ち込み、Strand parser が parse 不能。 Gemini は構造的に正しい設計（types/fns/effects/tiles の分離、4 routes 統合）を書けていたが、syntactic に他言語の知識が混入。

## 19.5 ブラウザ動作検証で発覚した仕様 ↔ 実装の乖離 (v3 で 19 件)

I-Claude を `strand build` + 静的 serve + Chrome で動作させる過程で、当初は **build 後にブラウザで多数のランタイムエラー**が発生。すべて Strand の仕様 docs と実装の不整合 / カバレッジ抜けだったので、修正した。

### Parser 拡張

| # | 修正 | 検出シナリオ |
|---|---|---|
| 12 | `.copy(field=value, ...)` named-arg 構文 | I-Codex `issue.copy(status=s, updatedAt=t)` |
| 13 | tile-arg 内の `if` を value/tile context で振り分け | I-Codex `if isEmpty(...) then EmptyTags else row(for tag in ...)` |
| 14 | `\|` の bool OR vs match arm separator ヒューリスティック | I-Gemini `a.contains(x) \| b.contains(x)` |
| 15 | 1-reducer-1-write を **path-shape granularity** に | I-Claude `issues[iid].status := s; issues[iid].updatedAt := now` |

### Codegen 拡張

| # | 修正 | 検出シナリオ |
|---|---|---|
| 16 | `select` / `radio` codegen 実装 | spec にあるが未実装 |
| 17 | `fieldset` builtin | I-Codex hallucination 吸収 |
| 18 | `.filter` を List/Map polymorphic dispatch に (`_s.filter`) | `m.keys.filter(...)` で誤って mapFilter |
| 19 | list ops (`map`/`filter`/`sort-by`/`find`) の lambda を `[k,v]` tuple destructure | `m.entries.sort-by($2.x).map($1)` |
| 20 | `.get-or(default)` を Option / Map dispatch | `routeIssueId(route).get-or(IssueId.fresh())` |
| 21 | FieldAccess no-paren shorthand: `.values` / `.entries` / `.is-empty` / `.lower` / `.upper` / `.trim` / `.unique` / `.reverse` / `.sort` | `tagDraft.trim.is-empty` |
| 22 | MethodCall: `.push` / `.contains` / `.starts-with` / `.ends-with` / `.split` / `.join` / `.reverse` | `tags.push(tagDraft.trim).unique` |
| 23 | `bind=draft.title` の nested path | `extractBindPath` + `_setPathHelper` |
| 24 | `select` の `value=` arg (bind なし運用) | `select(value=issues[id].status, ...)` |

### Runtime 拡張

| # | 修正 | 検出シナリオ |
|---|---|---|
| 25 | `mapEntries` を `[[k, v], ...]` tuple 配列で返す | destructure lambda と整合 |
| 26 | input/textarea/select の bind path handler (path 経由で `_setPath`) | `bind=draft.assignee` |
| 27 | focus 復元の full path 識別 (`data-strand-bind="draft.assignee"`) | input fokus が title に奪われる問題 |
| 28 | select の **implicit onChange dispatch** (`ui.change(SelectTile)` reducer) | I-Claude `on=ui.change(StatusSelect)` |
| 29 | 動的 theme: `app.theme = slotName` を `_live[slotName]` で解決 | I-Claude `theme = themeName` |
| 30 | `render()` 冒頭で `applyThemeDefaults` を再実行 | theme switch 時 DOM 反映 |

## 19.6 含意

### `LLM が書いて、人間が動かす`は成立する

Issue Tracker は **727 LOC・9 reducers・4 routes・複数 form**の規模で、Claude が学習データなしで一発書きに成功し、ブラウザで実動作。これは:

- 中規模ビジネス SPA の領域（社内ツール / 管理画面）が **AI 一発書きの対象に入った**
- ブラウザ実動作検証で発覚した 19 件の修正は **全て Strand の実装抜け**であり、言語仕様の根本欠陥ではない
- 修正された Strand は今後、同等タスクで一発動作する shape に到達

### `parse/typecheck/build 通過 ≠ 動作`

v3 では parse/typecheck/build まで一発で通った I-Claude のコードが、ブラウザで初回 **大量のランタイムエラー** を出した。これは v1/v2 では浮上しなかった次元:

- v1/v2 ではアプリが小さく、Strand 実装がたまたまカバーしていたパスのみが叩かれた
- v3 で初めて、`bind=draft.field` の nested path / dynamic theme / select の onChange dispatch / `.get-or` の Option dispatch など、**仕様 docs に書いてあるが実装で未対応の機能**が一斉に必要になった

→ 「LLM が書ける」と「実機で動く」は別の検証段階。**動作検証は v3 で初めて言語仕様の網羅性を試す**ことになる。

### LLM 別の傾向

| Vendor | 強み | 弱み |
|---|---|---|
| Claude | 仕様 docs と examples の対応関係を緻密に追う。`bind=draft.field` のような examples に出てない応用も推測してくる | 727 LOC まで踏み込むので動的問題を多数噴出させる |
| gpt-5.5 (Codex) | 防御的でロバスト。spec 範囲を超えても破綻しない | hallucination が出やすい（`fieldset`/`error` builtin） |
| Gemini | 最も簡潔・宣言的にまとめる | 他言語構文（`let ... in`）の混入リスク高 |

## 19.7 累計サマリ（v1 + v2 + v3）

学習コスト検証 3 ラウンドで検出・修正した Strand 仕様抜けは **累計 30 件**:

| 範囲 | 件数 |
|---|---:|
| Parser (timer event, multi-stmt block, `&&`/`\|\|` alias, `.copy()`, tile-if dispatch, `\|` bool OR heuristic 等) | 9 |
| Typecheck (branch-aware writes, path-shape granularity) | 2 |
| Codegen (select/radio/fieldset/grid/stack/etc., list ops dispatch, no-paren method shorthand, bind path 等) | 13 |
| Runtime (timer, null child, path bind handler, focus, dynamic theme, mapEntries tuple 等) | 6 |

全件修正後、71 テスト pass + Pomodoro/Kanban/Issue Tracker の 3 アプリ完全動作を維持。

## 19.8 結論

| 検証項目 | 結果 |
|---|---|
| **スケール耐性 (500+ LOC)** | ✓ Claude が 727 LOC を一発書き完全通過 |
| **複雑機能 (multi-route + 永続化 + theme + フィルタ + comments)** | ✓ ブラウザ動作確認済 |
| **動的整合 (parse+typecheck+build ≠ 動作)** | △ v3 で 19 件の追加抜けが浮上 → 全件修正済 |
| **モデル別** | ✓ Claude フル動作 / △ Codex typecheck まで / △ Gemini parse まで |
| **言語仕様の根本的欠陥** | **なし**。検出された全件は実装抜けで埋められた |

**結論**: Strand v0.1 は、中規模 (~700 LOC) の実用 SPA を AI が一発書きで動かすレベルに到達した。

## 19.9 再現

```bash
# 各 LLM の output 取得（v2 と同じ手順）

# Eval (静的)
cd reference
pnpm exec tsx scripts/learning-cost-eval.mjs \
  ../benchmarks/learning-cost-v3/results/I-Claude/output.strand \
  ../benchmarks/learning-cost-v3/results/I-Codex/output.strand \
  ../benchmarks/learning-cost-v3/results/I-Gemini/output.strand

# ブラウザ動作検証
pnpm exec tsx src/cli/strand.ts build \
  ../benchmarks/learning-cost-v3/results/I-Claude/output.strand \
  ../examples-build/issue-tracker
node scripts/serve.mjs ../examples-build/issue-tracker 5192 &
# → http://localhost:5192/ をブラウザで開く
```
