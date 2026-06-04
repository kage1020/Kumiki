# AI 編集 API / CRDT op

`../spec/ai-edit.md` で書いた CLI を実装し、Kumiki の "AI 専用" 思想の中核
である **構造化編集 + 参照整合性 + op-log** を動作させる。

CRDT graph store の本格実装はせず、`.kumiki` ファイル単位の **read-parse-mutate-write** で
動かす。並列 op の収束は本格 CRDT ではなく「op を順序付け、parse 失敗・
ref-integrity 違反を検出して reject」のレベル。

## ゴール

```bash
kumiki list                                    # 全定義名
kumiki list slot                               # 特定レイヤ
kumiki view slot.todos                         # 単一定義
kumiki view --with-deps reducer.add            # 依存込み
kumiki refs slot.todos                         # 参照元
kumiki check                                   # 型・参照・effect 全部
kumiki check --strict-a11y                     # a11y warning もエラー扱い
kumiki add slot users 'Map(UserId, User) = {}' # 新規追加
kumiki replace slot.todos 'Map(TodoId, Todo) = {}'
kumiki remove slot.draft                       # 参照があれば --cascade なしならエラー
kumiki remove slot.draft --cascade             # 参照箇所も削除
kumiki rename slot.draft newTodoText           # リネーム + 参照書き換え
kumiki fix                                     # 検出した修復可能エラーを自動修正
kumiki fix --apply E0103                       # 特定コードだけ
```

全 op は `<file>.kumiki-ops.jsonl` に追記される（git でレビュー可能）。

## スコープ

| 機能 | 実装 | 備考 |
|---|---|---|
| `list [layer]` | ✓ | 全定義 or レイヤ別 |
| `view <qname>` | ✓ | source-range を覚えて切り出す |
| `view --with-deps <qname>` | ✓ | 推移依存も含む |
| `refs <qname>` | ✓ | 参照元一覧 (file + line) |
| `check [--strict-a11y] [--json]` | ✓ | typecheck の結果を表示 |
| `add <layer> <name> <body>` | ✓ | ファイル末尾に追記 |
| `replace <qname> <body>` | ✓ | 該当 def を新本体で置換 |
| `remove <qname> [--cascade]` | ✓ | dependent ops も自動生成 |
| `rename <qname> <new>` | ✓ | 名前変更 + 参照箇所の置換 |
| `fix [--apply] [<code>]` | ✓ | did-you-mean、欠落 /404、ほか |
| op-log JSONL | ✓ | `<file>.kumiki-ops.jsonl` |
| MCP server | × | 後のフェーズへ |
| 真の CRDT 並列 merge | × | parse + ref-integrity だけで近似 |

## op-log フォーマット

```jsonl
{"op":"add","layer":"slot","name":"users","body":"Map(UserId, User) = {}","ts":1779000000000,"opId":"op_01..."}
{"op":"rename","layer":"slot","name":"draft","newName":"newTodoText","ts":1779000000001,"opId":"op_02..."}
{"op":"remove","layer":"slot","name":"obsolete","cascade":false,"ts":1779000000002,"opId":"op_03..."}
```

`opId` は ULID 風の単調増加 ID。`parent-ops` は単純化のため省略（直前 commit hash で代替）。

## 受け入れ基準

### AC-list/view
- `pnpm kumiki list` で packages/examples/apps/02-todomvc/app.kumiki の全 35 定義（type/slot/effect/reducer/fn/tile/app/theme 合計）を表示
- `pnpm kumiki view slot.todos` で `slot todos : Map(TodoId, Todo) = {}` を返す
- `pnpm kumiki view --with-deps reducer.addTodo` で関連 fn / slot も同梱

### AC-refs
- `pnpm kumiki refs slot.todos` で todos を参照する reducer / tile / fn の (name, file, line) を列挙

### AC-mutate
- `pnpm kumiki add slot foo 'Int = 0'` でファイル末尾に slot 追加、op-log に記録
- `pnpm kumiki replace slot.draft 'Text = ""'` で該当 slot だけ書き換え
- `pnpm kumiki remove slot.draft` で参照ありなら exit code 1 + エラー、`--cascade` でカスケード削除
- `pnpm kumiki rename slot.draft newTodoText` で定義 + 全参照を rename

### AC-fix
- packages/examples/apps/02-todomvc/app.kumiki に `slot usres : Int = 0; reducer r on=ui.click(B) do= usres := 1` のような typo を入れて `kumiki fix` がパッチ提案
- `--apply` で実適用

### AC-並列 op
- 2 つのエージェントが独立に op を JSONL に書き、片方ずつ replay しても収束する例

## 実装順序

1. **Definition store**: `.kumiki` を parse して `Map<qname, { def, fileRange }>` を作る
2. **list/view/refs/check**: read-only コマンド
3. **add/replace/remove/rename**: write-back
4. **op-log**: 各 mutate op で JSONL append
5. **fix**: 既存の typecheck エラーから auto-patch を生成
6. **並列 op 検証**: vitest で 2 ops を別順序で apply して同じ結果

## 設計メモ

- "本物の CRDT" は graph + content-hash + Add-Wins LWW-Map が必要。今回は **op 単位の commit** だけで近似
- ファイルベースのため、書き換えはテキスト単位（parse 単位ではない）。これで Git diff も人間が読める
- リネームは「定義行の名前変更」+「参照箇所の単純置換」（言語スコープを考慮しない）。スコープが破れる場合は後続の `check` で検出
