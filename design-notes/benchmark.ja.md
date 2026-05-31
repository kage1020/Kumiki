# ベンチマーク — Strand vs React (TodoMVC)

[English](./benchmark.md) · 日本語

Strand が "AI フレンドリー" を名乗るからには、**実コストの実測**が必要。同じ機能の TodoMVC を Strand と React で実装し、トークン数 / 行数 / 編集影響範囲を測った。

## 15.1 環境

| 項目 | 値 |
|---|---|
| Strand ソース | `docs/examples/02-todomvc.strand` |
| React ソース | `benchmarks/todomvc-react/src/App.tsx` |
| 機能セット | 追加 / 完了トグル / 削除 / Filter (All/Active/Done) / Clear completed / localStorage 永続化 / theme tokens |
| 計測スクリプト | `reference/scripts/measure.mjs`, `reference/scripts/measure-scenarios.mjs` |
| トークナイザ | `gpt-tokenizer` の `cl100k_base` (GPT-4) と `o200k_base` (GPT-4o) |

## 15.2 ファイルサイズ比較

```
label                    files  chars  loc-total  loc-code  cl100k  o200k
-----------------------  -----  -----  ---------  --------  ------  -----
strand (todomvc.strand)  1      4710   163        116       1358    1362
react  (App.tsx)         1      7357   279        236       1883    1923
```

### 比率 (React / Strand)

| 指標 | 比率 | 解釈 |
|---|---|---|
| 文字数 | **1.56x** | React のソースは Strand の 1.56 倍長い |
| LOC (空行/コメント除外) | **2.03x** | React の中身は 2 倍 |
| GPT-4 トークン (cl100k_base) | **1.39x** | Strand の方が **39% トークン節約** |
| GPT-4o トークン (o200k_base) | **1.41x** | 同 41% 節約 |

### 主な差分要因

| 差分源 | 影響 |
|---|---|
| Strand には `useState` / `useEffect` / コールバック束ねの宣言句がない | reducer/effect/slot を直接書くだけ |
| Strand は JSX `<div style={...}>` のような明示属性なし | tile prop の短縮形 (`{bg: "primary"}`) |
| Strand は TypeScript の `Record<TodoId, Todo>` のような generic 型注釈がいらない箇所がある | スキーマが宣言される箇所が 1 つ |
| Strand の `match` 式 / `for ... when` ループ | React では `Object.entries(...).filter(...).map(...)` の連鎖 |
| Strand の theme は宣言だけ。React は inline style 散在 | React 側で `theme.colors.primary` の参照を約 10 箇所書く |

## 15.3 編集影響範囲シナリオ（4 種）

4 つの典型的な変更を両実装に手で適用し、ベースからの diff の追加/削除/文字/トークンを集計した。

```
Per-scenario patch sizes (lines / chars / tokens)

scenario                 impl      +lines   -lines    chars   cl100k    o200k
------------------------------------------------------------------------------
01-add-priority          strand         4        4      568      175      181
                         react          8        3      483      150      156
02-strict-validation     strand         7        4      432      112      115
                         react          4        2      322       88       92
03-add-archived          strand        19       11     1540      442      448
                         react         27        9     1475      417      415
04-dark-theme            strand        25        6     1315      401      401
                         react         48       12     2153      638      638

Totals across scenarios
  strand : +55/-25  chars=3855  cl100k=1130  o200k=1145
  react  : +87/-26  chars=4433  cl100k=1293  o200k=1301

React / Strand ratios (totals)
  +lines : 1.58x
  chars  : 1.15x
  cl100k : 1.14x
  o200k  : 1.14x
```

### シナリオごとの解釈

| Scenario | Strand 文字数 | React 文字数 | 勝ち | コメント |
|---|---:|---:|---|---|
| 01: Todo に `priority` field 追加 | 568 | 483 | React (-15%) | sort 関数を multi-line にする React の表現が小さい |
| 02: validation 強化（trim + max 100） | 432 | 322 | React (-25%) | Strand は if-then-else block を `{ ... ; ... ; ... }` で書くと冗長 |
| 03: Filter に `Archived` variant + Todo `archived` field 追加 | 1540 | 1475 | 拮抗 | 機能追加（新ボタン・新 reducer）は同程度 |
| 04: ダークモード切替（Theme 2 種 + slot + reducer + UI） | 1315 | 2153 | **Strand (-39%)** | runtime に theme 機構があるので Strand 側は宣言だけで済む |

### 大規模ほど Strand 有利

- **小さな型変更 / バリデーション追加**: React の方が patch が短い（runtime ヘルパや変数名のオーバーヘッドがない）
- **新 variant / 新フィールド**: 拮抗（影響箇所の数で決まる）
- **横断的機能（ダークモード、a11y、エラー境界）**: Strand が圧倒。React は全コンポーネントに `theme` prop を drilling する必要があるが、Strand は theme 切替 slot 1 つ追加で完結

これは Strand の主張「**runtime にビルトイン機能を持つので、ユーザー側コードは薄くなる**」を裏付けた。横断的変更ほど差が広がる。

### 影響箇所の数（type システム横断）

| Scenario | Strand 箇所 | React 箇所 |
|---|---:|---:|
| 01-priority | 4 | 4 |
| 02-validation | 2 (addTodo, slot) | 2 (addTodo, JSX maxLength) |
| 03-archived | 7 (type, fn matchFilter, fn itemsLeft, FilterBar, TodoRow, addTodo, archive reducer) | 7 (type, matchFilter, itemsLeft, addTodo, TodoRow component, archive handler, render) |
| 04-dark-theme | 4 (新 theme 2 種, themeName slot, toggleTheme reducer, ThemeBtn) | 11 (新 theme 2 種, ThemeName/Theme 型, themeName state, theme 選択, toggle handler, ThemeBtn JSX, theme prop drilling × 5 箇所以上) |

03 までは箇所の数は同じだが、**04 だけ大きく違う**：React は theme を prop で全コンポーネントに渡す必要がある。

## 15.4 トークン効率の本質

| シナリオ | Strand 有利 | React 有利 |
|---|---|---|
| 新規プロジェクトをゼロから書く | ◯ (1.39〜1.56x 少ない) | |
| 既存プロジェクトに 1 フィールド追加 | (行は少ない) | △ (トークンは 14〜25% 少ない) |
| 既存プロジェクトに variant + 関連変更 | 拮抗 | 拮抗 |
| 横断的機能（theme/a11y/error-boundary） | ◎ (chars 39% 少ない) | |
| 4 シナリオの合計 | ◯ (chars 13% / token 12% 少ない) | |
| エージェント並列開発 (CRDT op) | 未計測 | 未計測 |

### 結論

- **新規生成（フル）**: Strand が 30〜40% 安い
- **小さな修正パッチ**: React の方が 15〜25% 安いことがある
- **横断的修正**: Strand が 40% 程度安い（runtime にビルトイン機構があるため）
- **合計**: 4 シナリオの patch を合算すると、Strand は React の 87% の文字数 / 87% のトークン数

## 15.4-bis Strand 編集 op の効率

仕様 16（AI 編集 API）で実装した `strand add / replace / remove` を使うと、
**「変更を受ける def の本体だけ」を送れば修正が完了する**。同じ 4 シナリオ
について、3 つの「修正の伝え方」を比較した：

| 形式 | AI が出力するもの | 長所 | 短所 |
|---|---|---|---|
| **full file** | 修正後のファイル全体 | AI には自然 | 変更しない 80% の def も毎回出力 |
| **patch (unified diff)** | `+` / `-` 行の diff | 最も小さい | AI が diff を正確に書くのは難しい |
| **op stream** | `add/replace/remove` の列 | AI に自然 + 自動 validation + op-log | patch より少し長い |

### 実測値

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

### 圧縮率（小さいほど良い）

| 比較 | 文字 | トークン |
|---|---|---|
| **op vs full-file** | 25.6% | **26.2%** (74% 削減) |
| op vs patch | 135% | 137% (op の方が冗長) |

### 解釈

- **AI が「修正後の全体コード」を吐く既定スタイル**（多くの coding agent のデフォルト）と比較すると、Strand の op stream は **74% トークン節約**できる
- **AI が unified diff を完全に正しく吐ける**なら patch のほうが短いが、現実の coding agent は diff 形式を時々破る。op stream は「修正後の def 本体」を渡すだけで `add/replace/remove` セマンティクスが付くので、フォーマットエラーが起きにくい
- 加えて op stream は **validate-then-rollback** によって、parse error / typecheck error が出るパッチは自動で reject される（patch には無い性質）

### つまり実プロダクション AI ループでは

1. **AI に修正タスクを指示**
2. **AI が「修正後の def を `add/replace` 形式で出力」**（Markdown ブロックで）
3. **CLI が op stream として読み込み、各 op を順次適用**
4. **どこかで validation 失敗 → 該当 op だけ reject、エージェントにエラーを返す**

このループの「2 → 3」の AI コストが、フルファイル方式の **約 1/4**。
これが AI 編集 API の経済的メリット。

## 15.5 計測の制約

- 比較は **同一機能だけ**。React の `useMemo` / `useCallback` / Suspense などの本気の最適化を入れると LOC は増えるが、Strand 側も signal-graph 最適化を入れていない（Phase 1 PoC レベル）
- React 側は **エラー境界 / theme 自動適用 / a11y チェック** を実装していない（Strand ランタイムには入っているが、React 版に同等を入れたら +50 行程度のはず）
- トークナイザの種類で差が出る (`cl100k_base` vs `o200k_base`)。両方とも 1.4 倍前後
- **編集影響範囲のシナリオは 1 件のみ**（priority field）。validation 追加 / variant 追加など他パターンは Phase 5 で

## 15.6 注意事項（読み手向け）

- **これは "Strand が React より優れている" の証拠ではない**。Strand は人間が読まない前提で表現を圧縮しているので、ただトークンが少ないだけ
- React は人間の認知に合わせた構文を持つので、人間メンテ向けには Strand より優秀
- "AI コーディングコストの観点では 1.4 倍違う" という事実が分かれば十分

## 15.7 再現

```bash
cd reference
node scripts/measure.mjs                       # フルファイルの比較
node scripts/measure-scenarios.mjs             # 4 シナリオの patch 比較
pnpm exec tsx scripts/measure-ops.mjs          # 同 4 シナリオの op stream コスト
```

## 15.8 数字（直書き、後で再生成する用）

最終計測: 2026-05-29

### フルファイル
| | Strand | React | React/Strand |
|---|---|---|---|
| chars | 4,710 | 7,357 | 1.56x |
| loc-code | 116 | 236 | 2.03x |
| cl100k | 1,358 | 1,883 | 1.39x |
| o200k | 1,362 | 1,923 | 1.41x |

### Patch 合計（4 シナリオ）
| | Strand | React | React/Strand |
|---|---|---|---|
| +lines | 55 | 87 | 1.58x |
| -lines | 25 | 26 | 1.04x |
| chars | 3,855 | 4,433 | 1.15x |
| cl100k | 1,130 | 1,293 | 1.14x |
| o200k | 1,145 | 1,301 | 1.14x |

### シナリオ別 chars (React/Strand 比)
- 01-add-priority: 0.85x (React 短い)
- 02-strict-validation: 0.75x (React 短い)
- 03-add-archived: 0.96x (拮抗)
- 04-dark-theme: 1.64x (Strand 短い)

### Strand 編集の "伝達コスト" 比較

| 形式 | 全 4 scenarios 合計 chars | 同 GPT-4 tokens |
|---|---:|---:|
| full file (AI が変更後コード全体を吐く) | 20,269 | 5,888 |
| patch (unified diff) | 3,855 | 1,130 |
| **op stream (strand add/replace/remove)** | 5,195 | **1,543** |

op stream はフルファイル方式の **26.2%** = **74% トークン節約**。
