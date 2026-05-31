# 学習コストベンチマーク v4 — 800-1500 LOC 大規模タスク + 全機能ブラウザ動作

[English](./learning-cost-v4.md) · 日本語

[v1](./learning-cost-v1.md) (Pomodoro)、[v2](./learning-cost-v2.md) (Kanban)、[v3](./learning-cost-v3.md) (Issue Tracker, 727 LOC) の続編。**Kumiki v0.1 で最大規模**の Project Management Tool で AI の実用上限を測る。

## 目的

v3 で Issue Tracker (727 LOC) の一発書き + ブラウザ全機能動作を達成。残る問い:

1. **1000+ LOC の壁**: さらに大規模で LLM の hallucination / 構造破綻が起きるか？
2. **深い階層**: Projects → Tasks → SubTasks → Comments の 4 階層、複数 view (List/Board)、複数 form を統合できるか？
3. **複合機能**: Board view (status 別カラム) / フィルタ / due date / theme を全部入りで一発動作するか？

v4 は **Project Management Tool**（Asana / Linear 風、5 routes、20+ reducers、List/Board 切替、サブタスク、due date）で検証。

## タスク

`benchmarks/learning-cost-v4/task-spec.md` — PM Tool SPA:
- 5 routes (`/`, `/projects/:id`, `/projects/:id/tasks/:taskId`, `/projects/:id/new-task`, `/settings`)
- 20+ reducers (Project CRUD / Task CRUD / status・priority・assignee・dueDate 編集 / tag / comment / filter / view 切替 / theme)
- List view ⇄ Board view (4 status カラム)
- Projects → Tasks (parentTaskId でサブタスク) → Comments の階層
- localStorage 永続化 (projects / tasks / comments)
- Light / Dark theme

## 結果

| 条件 | LOC | parse | typecheck | build | 全機能ブラウザ動作 |
|---|---:|:-:|:-:|:-:|:-:|
| P-Claude | 1255 | ✓ | ✗ | — | — |
| **P-Codex (gpt-5.5)** | **1309** | **✓** | **✓** | **✓** | **✓ (全機能動作)** |
| P-Gemini | 606 | ✗ | — | — | — |

### 計測した中で最大の一発通過 (P-Codex, 1309 LOC)

**これまでに計測した中で最大規模の一発通過**。OpenAI gpt-5.5 が 1300+ LOC の PM Tool を一発書きで parse/typecheck/build 通過。後述のランタイム修正後、ブラウザで全機能動作:
- Project 作成 / アーカイブ / 削除
- Task 作成 / status・priority・assignee・due date 編集 / tag / コメント / サブタスク
- **List view ⇄ Board view 切替**（Board は 4 status カラム）
- **フィルタ**（status / priority / assignee / search、Board でも有効）
- due date 設定（Overdue/Today/Soon/Upcoming 判定）
- Light/Dark theme 切替 / localStorage 永続化

### P-Claude (1255 LOC) — typecheck で 1-write 違反

P-Claude は最も網羅的に書いたが、`deleteTask` reducer で:
```kumiki
tasks := tasks.remove(tid)
tasks := tasks.filter(taskNotChildOf($2, tid))   # ← 同 path 2 回目で E0601
```
これは Kumiki の **1-reducer-1-write 制約**（path-shape granularity, [Language Core](../spec/language.md) §1.6.4）に対する違反。`tasks := tasks.remove(tid).filter(...)` とチェーンすれば 1-write で通る。agent-loop なら自己復旧できる範囲だが、一発書きでは違反した。**仕様の意図通りの reject** であり実装バグではない。

### P-Gemini (606 LOC) — tile に tuple 引数

Gemini は最も簡潔だが、`StatusColumn((p.id, Backlog))` のように **tile に tuple リテラル引数**を渡した。Kumiki の tile 引数は単一値で、tuple リテラルは未サポート。仕様外の構文を持ち込んだ。spec では record 引数 `{projectId: ..., status: ...}` を使うべき（P-Codex はこの形で正しく書いた）。

## ブラウザ動作検証で発覚した仕様 ↔ 実装の乖離 (v4 で 7 件)

P-Codex のコードを実機で動かす過程で発覚し、修正:

| # | 修正 | 検出シナリオ |
|---|---|---|
| 31 | `Duration.h/m/s/ms/d` コンストラクタを ms に変換 | `now.plus(Duration.h(72))` |
| 32 | `Time.plus / .minus / .diff` method（ms 演算） | `now.plus(...)` |
| 33 | `.flat-map` を Option dispatch (`flatMapOption`) | `routeProjectId(r).flat-map(ps.get($1))` |
| 34 | `.map` を List/Option polymorphic (`mapOver`) | `option.map(...)` / `list.map(...)` |
| 35 | `.filter` / `.map` の `.entries` tuple destructure 統一 | `ts.entries.filter($2.projectId == ...)` |
| 36 | input/textarea の **DOM-path focus 復元**（bind/id なしでも） | `value=`-only な検索ボックスで focus が外れる |
| 37 | **select の valueKey を payload まで再帰**（variant 衝突回避） | `Option(Status)` の `Some(Backlog)` / `Some(InProgress)` が全部 `_tag:"Some"` で衝突し「最後の選択肢」に固定される |
| 38 | named arg (`text=if c then ... else ...`) の if を value context | `button(text=if viewMode == ListView then "Board" else "List")` |

特に **#37 (valueKey の variant 衝突)** は v4 で初めて `Option(Variant)` を select の値にしたことで浮上した。フラットな `_tag` 比較では `Some(A)` と `Some(B)` が区別できず、最後の選択肢が常に選ばれる UX バグだった。

## 含意

### gpt-5.5 が 1300 LOC を一発書き

v3 では Claude が 727 LOC で勝者だったが、v4 では **gpt-5.5 (Codex) が 1309 LOC で唯一の完全通過**。モデルによって得意なスケール帯が違う:
- **Claude**: 仕様の応用力が高いが、踏み込みすぎて 1-write 制約に抵触
- **gpt-5.5**: 防御的・冗長だが大規模で堅牢。spec 通りの record 引数を選ぶ慎重さ
- **Gemini**: 簡潔だが他言語構文（tuple 引数、`let..in`）の混入リスク

### 「動く」の検証が言語の網羅性を試す

v4 でも parse/typecheck/build 通過後にブラウザで 7 件のランタイム抜けが発覚。これらは **「より深い機能を使ったとき初めて叩かれるパス」**:
- `Option(Variant)` を select 値にする（valueKey 衝突）
- `Duration` 演算（due date）
- `.flat-map` で Option をチェーン
- bind なし `value=` 検索ボックスの focus

小規模アプリでは決して踏まない経路で、**大規模アプリが言語実装の網羅性を試す**という v3 の知見が再確認された。

## 累計サマリ（v1〜v4）

学習コスト検証 4 ラウンドで検出・修正した Kumiki 実装抜けは **累計 38 件**:

| 範囲 | 累計件数 |
|---|---:|
| Parser | 11 |
| Typecheck | 2 |
| Codegen | 17 |
| Runtime | 8 |

全件修正後、71 テスト pass + Pomodoro / Kanban / Issue Tracker / **PM Tool (1309 LOC)** の 4 アプリ完全動作。

## 結論

| 検証項目 | 結果 |
|---|---|
| **1000+ LOC の壁** | ✓ gpt-5.5 が 1309 LOC を一発書き完全通過 |
| **深い階層 (Project→Task→SubTask→Comment)** | ✓ ブラウザ動作確認済 |
| **複合機能 (List/Board + フィルタ + due date + theme)** | ✓ 全機能動作 |
| **動的整合** | △ v4 で 7 件の追加抜け → 全件修正済 |
| **言語仕様の根本的欠陥** | **なし**。検出された全件は実装抜けで埋められた |

**結論**: Kumiki v0.1 は、1300 LOC 級の実用 SaaS 相当 SPA を AI が一発書きで動かすレベルに到達した。中規模ビジネスアプリ（プロジェクト管理 / チケット管理 / 管理画面）が AI 一発書きの射程に完全に入った。

## 再現

```bash
node benchmarks/scripts/learning-cost-eval.mjs \
  benchmarks/learning-cost-v4/results/P-Claude/output.kumiki \
  benchmarks/learning-cost-v4/results/P-Codex/output.kumiki \
  benchmarks/learning-cost-v4/results/P-Gemini/output.kumiki

pnpm --filter @kumiki/cli exec tsx src/kumiki.ts build \
  benchmarks/learning-cost-v4/results/P-Codex/output.kumiki \
  out/pm-tool
node benchmarks/scripts/serve.mjs out/pm-tool 5193 &
# → http://localhost:5193/
```
