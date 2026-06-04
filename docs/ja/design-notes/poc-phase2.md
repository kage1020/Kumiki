# PoC Phase 2 — TodoMVC が動く実装の仕様

## ゴール

`packages/examples/apps/02-todomvc/app.kumiki` を入力に `kumiki build` を実行すると、ブラウザで開いて以下が動作する：

- Todo の追加（input + Enter）
- 完了トグル（checkbox）
- 個別削除（× ボタン）
- フィルタ（All / Active / Done）
- Clear completed
- localStorage への自動永続化（debounce 300ms）
- リロード後も Todo が保持される

Phase 1 で動かなかった機能をすべて入れる。

## サポート範囲（Phase 2 追加分）

| カバー | 詳細 |
|---|---|
| `type` 拡張 | record `{a:T, b:U}`、union `A \| B(T) \| C`、generic application `Map(K,V)` / `Option(T)` / `Result(T,E)`、refinement (nonempty / len-lt / uuid / etc)、type alias with params |
| `slot` 拡張 | volatile / transient modifier、Map/Set/List/Option を初期値に取れる |
| `effect` | 完全な構文。capability check、policy (latest/latest-per-key/queue/debounce/throttle/once)、retry、map-request |
| `reducer` 拡張 | `app.start` などのライフサイクル event、`effect.ok($v, $key)` / `.err($e, $key)`、let、emit、lvalue path（`todos[id].done := v`）、`$el.todoId` / `$event.value` |
| `tile` 拡張 | `in=T`、`for x in c expr`、`when(cond, expr)`、`if e then e else e`、`match e with | P -> e \| ...`、`{key: ...}` props、位置引数で tile 呼び出し |
| `fn` | 完全な構文。引数型、戻り値型、純粋性、再帰禁止 |
| 式 | match、let-in、if-then-else、record リテラル、map/list/set リテラル、field access、index、メソッドチェーン (Map.keys.sort-by($1) など) |
| 組み込み tile | form / input / textarea / check / spinner / skeleton（最小） |
| ビルトイン | TypeName.fresh()、now、Time.format、math、Map/Set/List/Option/Result の必要メソッド |

Phase 2 で **扱わない**: routing 解決、theme 完全対応、a11y 検証、AI 編集 API、episode log、SSR/Edge、HTTP capability、IndexedDB、analytics、WebSocket、アニメーション。

## 受け入れ基準（AC）

TDD で先に固める。

### AC-Lexer 追加

- `300ms`, `2s`, `1m` → duration リテラル（または数値+識別子）として字句化
- `Map(K, V)` → 識別子 + `(` + 識別子 + `,` + 識別子 + `)`
- 既存トークンに加えて `match`, `with` キーワードが認識される

### AC-Parser: 型

```
type Todo = {id: TodoId, text: Text where nonempty, done: Bool, createdAt: Time}
type Filter = All | Active | Done
type LoadResult(T) = Idle | Loading | Loaded(T) | Failed(HttpError)
slot todos : Map(TodoId, Todo) = {}
```

- record / union / generic / refinement (nonempty/uuid/len-lt/email/url) / type param がパースできる
- 初期値が collection リテラルでも OK

### AC-Parser: 式

```
match f with | All -> true | Active -> not t.done | Done -> t.done
todos.filter(not $2.done).size
todos.keys.sort-by(-todos[$1].createdAt.to-ms)
{id, text=draft, done=false, createdAt=now}
let id = TodoId.fresh()
todos[id].done := not todos[id].done
```

- match / let / record リテラル / method chain / lvalue path がすべてパースできる

### AC-Parser: fn / effect

```
fn matchFilter(t: Todo, f: Filter) -> Bool = match f with | All -> true | ...
fn itemsLeft(ts: Map(TodoId, Todo)) -> Int = ts.filter(not $2.done).size

effect loadTodos cap=storage.read
                 in=Unit
                 out=Result(Option(Map(TodoId, Todo)), Text)
                 policy=once
                 map-request={key: "todos", decode: Decoder.Json(Map(TodoId, Todo))}
```

- fn / effect 完全構文がパースできる

### AC-Parser: tile 拡張

```
tile TodoRow in=TodoId = row(check(...), text(...), button(...) {todoId: $1})
tile TodoList = column(for id in todos.keys when(matchFilter(todos[id], filter), TodoRow(id) {key: id.show}))
```

- in= 引数、for/when/if、props、tile call with positional+named args

### AC-Typecheck

- `Map(K, V)` 等の generic application が型として解決される
- `fn` 内で slot 読み書きや emit をするとエラー (E0305)
- `effect` の cap が `app.caps` に無いとエラー (E0301)
- match の variant に未定義パターンがあるとエラー
- lvalue path の最終 slot が存在しないとエラー (E0103)

### AC-Effect Dispatcher

- `emit loadTodos()` が dispatcher 経由で storage.read を呼ぶ
- 結果が `loadTodos.ok($m, _)` / `.err($e, _)` reducer に届く
- `policy=debounce(300ms)` で連続呼び出しがまとめられる
- `policy=once` で初回のみ実行
- capability 未宣言の effect 呼び出しはランタイムで no-op + 警告

### AC-Runtime 拡張

- `form` + `input` + `check` + `spinner` の DOM 描画
- `for` ループで動的リスト描画
- `match` 式が if-else 連鎖に展開されて動く
- lvalue path の immutable update が正しく動く
- localStorage への保存と起動時ロード

### AC-CLI

```
pnpm kumiki build packages/examples/apps/02-todomvc/app.kumiki out/todomvc
```

- 終了コード 0
- 既存と同じく index.html / app.js / runtime.js が出る

### AC-E2E (手動)

ブラウザで:
1. text を入力して Enter → 行が追加される
2. checkbox を押す → 取り消し線が付く
3. × を押す → 削除される
4. Filter を Active/Done に切り替え → 該当のみ表示
5. Clear completed → done が消える
6. リロードすると同じ状態が復元される（localStorage）

## 実装順序（TDD）

| step | 内容 | テスト |
|---|---|---|
| 1 | AST + lexer 拡張 | lexer.test.ts に追加 |
| 2 | parser: 型システム | parser.test.ts に追加 |
| 3 | parser: 式と lvalue path | 同上 |
| 4 | parser: fn / effect / tile 制御 | 同上 |
| 5 | typecheck 拡張 | typecheck.test.ts に追加 |
| 6 | effect dispatcher | dispatcher.test.ts 新規 |
| 7 | runtime collection helper + 新 tile 要素 | runtime.test.ts に追加 |
| 8 | codegen 拡張 | codegen.test.ts に追加 |
| 9 | TodoMVC build & 手動確認 | E2E |

## 設計上の判断（PoC スコープ）

| 判断 | 理由 |
|---|---|
| TodoMVC を動かす機能だけ集中 | scope creep を避ける |
| match は switch ではなく if-else 連鎖で展開 | union variant の payload bind が switch では書きにくい |
| collection は immutable な純関数で実装 | 仕様通り、関数型らしい挙動を保証 |
| effect dispatcher は runtime に組み込む | Phase 1 で stub だった部分を実装 |
| localStorage はランタイムが直接読み書き | capability handler の最初の例 |
| Theme / a11y / routing は Phase 3 | TodoMVC 単体には不要 |

## 完了の定義

- すべての AC が pass
- `out/todomvc/index.html` を実ブラウザで開いて全機能が動作
- リロード後も Todo が保持される（localStorage）
- 既存の Counter テストも回帰なく pass
