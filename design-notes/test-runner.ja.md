# `test` レイヤー と `kumiki test` ランナー (v0.2 M4)

[English](./test-runner.md) · 日本語

[spec/testing.md](../spec/testing.ja.md) §8 は言語内の `test` 定義レイヤー（reducer-test / tile-test / property-test / episode-test）と `kumiki test` ランナーを記述している。**しかしそのいずれも未実装だった** — `test` キーワードも AST ノードもランナーも無く、リポジトリの実際の layer-3 検証は scenario（`runScenario`）+ smoke だった。M4 はランナー + DSL を実装して `test` 定義を実体化し、その上に（M4b）`kumiki fix --auto-patch <test-name>` を載せる。本ノートはスコープ判断を記録する。

## スコープ

**今回実装（M4a）：**

- `test` 定義レイヤー：`test <name> = <test-expr>`。他の定義同様に扱うが、**本番ビルドからは除外**（codegen はテストを別の `__kumikiTests` に emit し、mount しない）。
- **reducer-test** — `given = {slots, event}` → 当該 reducer を 1 回 apply → `expect = {slots, effects}`（結果の slot 値 + emit された effect 呼び出しを比較）。panic 形式 `expect = {panic: "msg"}` も対応。
- **tile-test** — `given = {slots}` → 当該 tile を render → 構造を `expect = <tile-expr>` と比較（tile ツリーの深い構造比較。spec §8.4 通り、明示指定した prop のみ比較）。
- **`kumiki test [filter]`** ランナー — test 定義を発見して各々を実行し、spec §8.7.1 の PASS/FAIL 出力（失敗時は構造 diff）を表示、いずれか失敗で非ゼロ終了。`filter` は完全名または `prefix-*` ワイルドカード。

**繰り延べ（後続、ここで追跡）：**

- `expect` 内の**ワイルドカード**（`<any-id>`、`<slots.X>` 後方参照）— 値位置の `<…>` に lexer/parser 対応が必要。M4a は厳密一致を要求。
- **reducer-test 内の effect 結果モック**（spec §8.5 の多段フロー）— M4a の reducer-test は単一の純粋 apply。effect の往復（結果をモックして `.ok` reducer を走らせる）は繰り延べ（scenario ランナーが既にその形を担う）。
- **tile-test の `given.in`**（tile の `$1` 入力の受け渡し）— パースはされるが、render される tile にまだ渡していない。
- **property-test**（型駆動ジェネレータ + 縮小、§8.3）と **episode-test**（ログ再生、§8.6）。
- **`--watch` / `--coverage`**（§8.7）。

これらは加算的で、各々後から example + test 付きで追加できる（リポジトリの「example と test で答える」方針と整合）。

## 実行モデル

`codegen` が `__kumikiApp` の隣に `__kumikiTests` 配列を emit する。各要素は `{ name, kind, run() }` で、`run()` は app のコンパイル済み reducer/tile をクロージャに取り込む：

- **reducer-test**：`given.event` からイベントペイロードを構築し、reducer の `apply(given.slots, payload)` を呼び、`{slots, effects}` を コンパイル済み `expect` と構造比較（または期待した panic が投げられたか）。
- **tile-test**：`given.slots` を与え、tile thunk を呼んで実際の `TileNode` を得て、`expect` を期待 `TileNode` にコンパイルし、構造比較（`expect` に無い prop は無視）。

`given`/`expect` の値は通常の式 codegen を再利用するので、record / list / variant / リテラルは app と全く同様に評価される。`kumiki test` コマンドは（`build` 同様に）モジュールをバンドルして import し、`__kumikiTests` を実行してレポートを描画する。比較 + diff は `@kumikijs/runtime`（`runTests`）に置き、CLI と将来の `fix --auto-patch` が同じオラクルを共有する。

## 受け入れ基準（M4a）

- AC1: `test t = reducer-test R given={slots,event} expect={slots,effects}` が `TestDef` にパースされる。未知の reducer/tile 参照はコンパイルエラー（E0102 / E0105）。
- AC2: `kumiki test` が全 `test` 定義を実行し、`PASS <name>` / `FAIL <name>` を表示、失敗時は `expected` / `actual` / `diff at` ブロックを出す（spec §8.7.1）。いずれか失敗時のみ非ゼロ終了。
- AC3: reducer-test は、reducer の結果 slot + emit effect が `expect` と一致すれば PASS、違えば（diff 付き）FAIL。
- AC4: `expect = {panic: "msg"}` は、reducer がそのメッセージで panic したときのみ PASS。
- AC5: tile-test は、render した tile 構造が `expect` と一致すれば PASS。`expect` に挙げた prop のみ比較。
- AC6: `kumiki test <name>` / `kumiki test <prefix>-*` が実行対象を絞り込む。
- AC7: test 定義は `kumiki build` 出力から除外される（本番バンドルに `__kumikiTests` は無い／あっても inert で mount されない）。
- AC8: `test` 定義を持つ新 example が `check` + `build` + `kumiki test` を通過。ランナー自体にも単体カバレッジ。`spec/testing.md` §8 に実装済み中核と繰り延べを明記。

## M4a の後

M4b は `kumiki fix --auto-patch <test-name>`（[roadmap](./roadmap-v0.2.ja.md) M4）を実装する：当該テストを実行し、既知の修正可能エラーコードに対応する失敗には `planFixes` を再利用して提案・適用・再実行し、決定論的パッチが無い場合は明確な diff を報告する。
