# テスト

[English](./testing.md) · 日本語

Strand のテストは **3 種類**：

1. **reducer test** — 純粋関数なので入力と期待出力で検証
2. **effect mock** — capability ガード境界でモックして dispatcher 動作を検証
3. **episode replay** — 実運用 trace を mock effect で再生して回帰検出

すべて Strand 言語の中で記述する（外部テストフレームワーク不要）。

## 8.1 テスト定義レイヤ

```ebnf
test-def ::= 'test' identifier '=' test-expr
test-expr ::= reducer-test | tile-test | episode-test | property-test
```

`test` 定義は **6 つ目のレイヤ**。CRDT graph に格納され、`strand test` で実行される。本番ビルドには含まれない。

## 8.2 Reducer テスト

```strand
test addTodo-basic =
    reducer-test addTodo
        given = {
            slots: {todos: {}, draft: "Hello"},
            event: {type: ui.submit, target: NewTodoForm}
        }
        expect = {
            slots: {todos: {<any-id>: {text: "Hello", done: false}}, draft: ""},
            effects: [persist(<slots.todos>)]
        }
```

### 8.2.1 構文

```ebnf
reducer-test ::= 'reducer-test' identifier
                 'given'  '=' '{' 'slots' ':' record-lit ',' 'event' ':' event-lit '}'
                 'expect' '=' '{' 'slots' ':' record-lit ',' 'effects' ':' effect-list '}'

event-lit ::= '{' 'type' ':' event-pattern (',' kv)* '}'
effect-list ::= '[' (effect-call (',' effect-call)*)? ']'
```

### 8.2.2 ワイルドカード

`<any-id>` は「任意の生成 ID」、`<slots.todos>` は「実行後の slot 値への参照」。

### 8.2.3 panic を期待

```strand
test addTodo-empty =
    reducer-test addTodo
        given = {slots: {todos: {}, draft: ""}, event: {type: ui.submit, target: NewTodoForm}}
        expect = {panic: "draft cannot be empty"}
```

## 8.3 Property テスト

```strand
test toggle-is-involution =
    property-test
        for-all = {todoId: TodoId, todos: Map(TodoId, Todo)}
        given = {slots: {todos: todos}, event: {type: ui.click, target: TodoRow, el: {todoId: todoId}}}
        invariant = run-reducer(toggle).run-reducer(toggle).slots.todos == todos
```

### 8.3.1 構文

```ebnf
property-test ::= 'property-test'
                  'for-all'    '=' record-lit       ; 生成する変数
                  'given'      '=' record-lit
                  'invariant'  '=' expr
                  ('count'     '=' int)?            ; 試行回数（デフォルト 100）
                  ('shrink'    '=' bool)?           ; 失敗時の最小化（デフォルト true）
```

### 8.3.2 ジェネレータ

各型は自動生成器を持つ：

| 型 | デフォルト生成 |
|---|---|
| `Int` | -1000 ~ 1000 |
| `Float` | -1000.0 ~ 1000.0 |
| `Text` | 0~50 文字、ASCII |
| `Bool` | true/false |
| `List(T)` | 0~10 要素 |
| `Map(K, V)` | 0~10 要素 |
| `Set(T)` | 0~10 要素 |
| `Option(T)` | 50% None / 50% Some |
| `Result(T, E)` | 50% Ok / 50% Err |
| `nominal T` | T の生成器 |
| `refinement T where p` | T を生成して p を満たすまで rejection |

カスタム生成器：

```strand
test foo =
    property-test
        for-all = {x: Int where between(0, 100)}
        ...
```

## 8.4 Tile snapshot テスト

tile の構造を期待値と比較：

```strand
test counter-display =
    tile-test App
        given = {slots: {count: 5}, in: ()}
        expect = column(
                   heading("Count: 5"),
                   row(DecBtn, ResetBtn, IncBtn))
```

snapshot は深い構造比較。クラス名やスタイルは比較対象外（明示指定したものだけ）。

## 8.5 Effect mock

effect の戻り値を差し替える：

```strand
test loadUser-success =
    reducer-test fetchUser-flow
        given = {
            slots: {users: {}},
            event: {type: ui.click, target: LoadBtn, el: {userId: "u1"}},
            mocks: {
                loadUser: ok({id: "u1", name: "Alice", email: "a@x.com"})
            }
        }
        expect = {
            slots: {users: {"u1": Loaded({id: "u1", name: "Alice", email: "a@x.com"})}},
            effects: []
        }
```

`mocks: {effect-name: ok(value) | err(error) | delay(ms, ok(value))}` で任意の effect の結果を差し替える。

## 8.6 Episode replay

実運用で記録した episode log を再生して結果を検証：

```strand
test bug-2026-05-21 =
    episode-test
        load    = "fixtures/episode-2026-05-21.log"
        mocks   = {
            loadUser: from-log,        ; ログに記録された結果をそのまま返す
            persist:  ignore
        }
        expect  = {
            slots-equal: from-log,     ; 最終 slot がログの記録と一致
            no-panics: true
        }
```

### 8.6.1 episode log の形式

→ [Runtime](./runtime.md) で詳述。

### 8.6.2 用途

- バグ報告に付随した episode log を fixture にして regression test 化
- モデル / アルゴリズムを変更した後でも同じ入力で同じ結果が出るか確認
- スキーマ変更時に旧 log が migration できるか検証

## 8.7 ランナー

```bash
strand test                    # 全テスト実行
strand test reducer-test       # reducer-test のみ
strand test addTodo-*          # ワイルドカードフィルタ
strand test --watch            # 変更時に再実行
strand test --coverage         # カバレッジ (reducer/effect/tile 単位)
```

### 8.7.1 出力

```
PASS  addTodo-basic        (1ms)
PASS  toggle-is-involution (100 cases, 23ms)
FAIL  counter-display
  expected: column(heading("Count: 5"), row(...))
  actual:   column(heading("Count: 0"), row(...))
  diff at:  [0].text  "Count: 5" -> "Count: 0"
```

エラーは `strand fix --auto-patch <test-name>` で**修正パッチを提案**するモードを v0.2 で実装予定。

## 8.8 統合テスト（ブラウザ駆動）

E2E はランタイム外で実装する。Playwright / Cypress などの既存ツールを使う。Strand 側からは：

- **`test-id` prop** をすべての tile に付けられる
- **`data-strand-tile`** 属性がランタイムから自動付与される
- **`window.__STRAND__`** で内部 slot を read-only で取り出せる（テスト時のみ）

```javascript
// Playwright 例
await page.locator('[data-strand-test=add-btn]').click()
const todos = await page.evaluate(() => window.__STRAND__.slots.todos)
expect(Object.keys(todos)).toHaveLength(1)
```

## 8.9 設計上の判断記録

| 判断 | 理由 |
|---|---|
| テストを言語内に書く | 別言語にすると AI の学習対象が増える |
| reducer は純粋関数なので入出力比較で十分 | mock 不要、決定論的 |
| property test を一級市民に | reducer の不変条件を構造で検証 |
| episode replay を一級市民に | 本番バグを自動的にテスト化できる |
| E2E は外部ツール | Strand のスコープ外、既存ツールを尊重 |

## 8.10 ツールによる検証の 3 層

上記の `test` 定義（言語内テスト）とは別に、ツールチェインは段階的な検証を提供する。各層は前の層が捕まえられないものを捕まえる。**`check`/`build` が通っても「動く」ことの証明にはならない**点が重要である。

| 層 | コマンド | 捕まえるもの | 捕まえないもの |
|---|---|---|---|
| 1. コンパイル | `strand check` / `strand build` | 構文・型・参照解決・codegen | 実行時の挙動 |
| 2. ランタイム smoke | `strand smoke` | mount 例外・空描画・未処理 rejection（headless DOM に mount し、全 button/input/select を操作） | 結果の正しさ |
| 3. 振る舞いアサーション | `test` 定義 / example 固有テスト | 「結果が正しいか」（例: select が常に最後の選択肢になる等の非例外バグ） | — |

### smoke（層 2）

`strand smoke <file>` は、コンパイル済みアプリを headless DOM（jsdom）に mount し、初期描画後にすべての操作可能要素へイベントを発火させ、各ステップでランタイム例外・コンソールエラー・未処理 rejection・空描画を監視する。「型は通るが、ランタイムに存在しないメソッドを呼んで操作時に落ちる」「描画されない」といった、従来は人がブラウザで確認していたクラスのバグを自動で検出する。汎用であり、アプリ固有の知識を持たない。

ブラウザでの実描画（CSS レイアウト・実フォーカス等）は jsdom では再現しきれない。そのための**実ブラウザ tier** が `@strand/e2e`（Chromium / Playwright）であり、jsdom と**同じシナリオ形式**で動く。状態 oracle は同じく `window.__strandApp.live`、表示テキストは `innerText`（可視のみ）。加えてブラウザ限定アサーションを持つ:

- `focused`: 指定セレクタが実際にフォーカスされていること（再レンダリング時のフォーカス奪取バグを検出）
- `visible` / `hidden`: 計算済みスタイル上で本当に見えている／いないこと（`display:none` 等）

重い（ブラウザバイナリ）ため既定の CI テストには含めず、フォーカス・レイアウト・実描画の確認や最終検証で使う opt-in 層。結果の**正しさ**は smoke では判定できず、層 3 のアサーションが担う。

`@strand/mcp` は同等の `strand_smoke` を提供し、AI エージェントが編集後に自己検証できる。

### シナリオ実行（層 2→3 の橋渡し）と自律ループ

`strand run <file> <scenario.json>`（MCP: `strand_run_scenario`）は、アプリを**シナリオ**で駆動し、毎ステップの構造化 trace を返す。これが「人を介さない生成→実行→観測→修正ループ」の土台になる。

- **操作（action）**: `{dispatch, payload?}`（reducer を名前で発火）/ `{clickText}` / `{click}` / `{fill, value}` / `{choose, value}` / `{navigate}`。
- **観測**: 各ステップ後に `state`（slot スナップショット）・`domText`・`errors`・`emits`（発火した effect）を記録。
- **アサーション（expect）**: `{ noErrors?, state?, domIncludes?, domExcludes? }`。`state` は **slot 状態への部分一致**（ドット区切りパス可）。DOM テキストではなく状態を検証できるため、「select が常に最後の選択肢になる」ような**非例外の振る舞いバグ**（人がクリックして気づくクラス）を機械的に検出できる。これは TDD の受け入れ基準（AC）を実行可能にしたものに等しい。
- **effect スクリプト**: `effects: { <name>: [{outcome, value}, ...] }` で HTTP / Storage の結果を順に差し替え、ループを決定論的・ネットワーク非依存に保つ。

なぜ Strand でこれが綺麗に成立するか: 状態が明示的（slot）なので oracle が信頼でき、イベントが宣言的（reducer 名）なので正確に駆動でき、effect が capability 境界でモック可能なので再現性がある。エージェントが要件から「アプリ + シナリオ（AC）」を生成し、trace を読んで自己修正することで、人は要件を一度述べるだけでよい。ループの手順は `.claude/skills/strand-iterate` に記述。

## 8.11 次

- AI 編集と自動修正 → [AI Editing](./ai-edit.md)
- ランタイム内部 → [Runtime](./runtime.md)
