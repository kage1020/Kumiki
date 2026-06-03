# Changelog

[English](./CHANGELOG.md) · 日本語

形式は [Keep a Changelog](https://keepachangelog.com/) に準拠し、[Semantic Versioning](https://semver.org/) を採用する。

## [Unreleased]

### Planned — v0.2

スコープ・設計・受け入れ基準：[design-notes/roadmap-v0.2.ja.md](./design-notes/roadmap-v0.2.ja.md)。spec が既に「planned for v0.2」と明記している 5 項目を、独立したマイルストーン（M1–M5）として出荷する。M1–M3 と M4a は出荷済み（下の _Added_ 参照）：

- **M4b — `kumiki fix --auto-patch <test-name>`**：`fix` を typecheck エラーからテスト失敗まで拡張し、ソースパッチを提案・適用。M4a のテストランナー上に構築（`spec/testing.md §8.7.1`）。
- **M5 — `motion` レイヤー**：グローバル CSS の抜け穴のない、宣言的でスコープされた transition / keyframes（`spec/style.md §4.9`）。

### Added

- **v0.2 M4a — `test` レイヤー + `kumiki test` ランナー**：言語内テストを `kumiki test [name|prefix*]` で実行。`reducer-test R given={slots,event} expect={slots,effects}` は reducer の純粋出力を検証（または `expect={panic:"…"}`）、`tile-test T given={slots} expect=<tile-expr>` は render した tile を構造比較（spec §8.4 通り props/handler は無視）。出力は spec §8.7.1 の PASS/FAIL + `expected`/`actual`/`diff at`、失敗時は非ゼロ終了。テストは `kumiki build` から除外（codegen `includeTests`）。record リテラルがキーワードのフィールド名（`type:` / `in:` 等）を受理するようになった。新規 example `examples/features/28-tests.kumiki`。_未実装_：`property-test`、`episode-test`、`expect` ワイルドカード、reducer-test の effect 結果モック、`--watch`/`--coverage`（[design-notes/test-runner.ja.md](./design-notes/test-runner.ja.md)）。（[spec/testing.md](./spec/testing.md) §8）
- **v0.2 M3 — プラグインによる capability 登録**：プロジェクトは `.kumiki` ファイルと同じディレクトリの `kumiki.caps.json` マニフェストで独自 capability を登録できる。登録名は `app.caps` で受理され、その effect は emit 可能になり capability 境界で dispatch される（標準 effect と同様 scenario でモック可能）。併せて spec が長らく定めていた「**未登録 capability はコンパイルエラー**」を実装した — 標準 capability セット + 新 **E0302 `unknown-capability`**（従来は任意の cap 文字列を受理しており `spec/stdlib.md §2.5` と乖離していた）。マニフェストは宣言的な capability 境界であって**新しい構文ではない**（rationale の非ゴールを維持）。CLI・MCP（`capabilities` 引数 / 同居マニフェスト）・テストハーネスが解決する。新規 example `examples/features/27-custom-capability.kumiki` + `kumiki.caps.json`。（[spec/stdlib.md](./spec/stdlib.md) §2.5）
- **v0.2 M2 — `overlay` builtin**：`overlay(...children)` による z 軸重ね。最初の子がベース層（通常フロー）、以降の子はコンテナ上に絶対配置される（ベースのレイアウトは決してずれない）— モーダル / トースト / ドロップダウン / ツールチップの土台。`align` prop が重ねる子を配置（縦 `top`/`bottom` ＋ 横 `left`/`right` を `-` で連結、例 `top-left`、既定 `center`、未知は `center`）。`when(...)` と合成して mount/unmount。CSS は自己完結（グローバル CSS の抜け穴なし）。新規 example `examples/features/26-overlay.kumiki`。（[spec/style.md](./spec/style.md) §4.4.3）
- **v0.2 M1 — `stop-timer(name)`**：タイマートリガーに `timer(d, name=N)` で名前を付与でき、reducer から `stop-timer(N)` 文で停止できる。タイマー名は単一ネームスペースを共有し一意でなければならない（重複は **E0002**）。未宣言の名前への `stop-timer` は **E0106**。`stop-timer` は純粋な制御文 — reducer は `stopTimers` を返し runtime が interval を clear するので、reducer の純粋性は保たれる。全タイマー（稼働中・停止中問わず）は `app` dispose 時に clear される。新規 example `examples/features/25-stop-timer.kumiki`。（[spec/lifecycle.md](./spec/lifecycle.md) §7.1.5）
- pnpm + Turborepo モノレポ構成（`@kumiki/compiler` / `@kumiki/runtime` / `@kumiki/cli` / `@kumiki/mcp`）。
- `@kumiki/mcp`: コンパイラと AI 編集・仕様検索を MCP ツールとして公開する MCP サーバー。
- **ランタイム smoke テスト**: `@kumiki/runtime` の `smoke()`、CLI `kumiki smoke <file>`、MCP `kumiki_smoke`。headless DOM に mount して UI を操作し、`check`/`build` では捕まらないランタイム例外・空描画・未処理 rejection を検出。全 example が CI で smoke 検証される（`tests/smoke.test.ts`）。3 層検証モデルは [spec/testing.md](./spec/testing.md) §8.10。
- **シナリオランナーと自律ループ substrate**: `@kumiki/runtime` の `runScenario()`、CLI `kumiki run <file> <scenario.json>`、MCP `kumiki_run_scenario`。操作列 + slot 状態アサーションでアプリを駆動し、毎ステップの状態・DOM・エラー・emit を trace で返す。effect は capability 境界でモックされ決定論的。状態を oracle にするため「select が常に最後の選択肢になる」等の非例外バグも検出可能。人を介さない生成→実行→観測→修正ループの手順は `.claude/skills/kumiki-iterate`。
- **実ブラウザ検証 tier `@kumiki/e2e`**（Chromium / Playwright）: jsdom と同じシナリオ形式を実ブラウザで実行し、`focused`（実フォーカス）・`visible`/`hidden`（計算済み可視性）など jsdom では検証できない層を捕捉。opt-in（ブラウザバイナリが重く既定 CI には含めない）。例: `examples/apps/06-expenses/scenario.browser.json`。
- `spec/`: 正規仕様を再編。エラーコードカタログ `spec/errors.md`（E0001..E07xx）を新設。
- `examples/`: 機能別ミニマル例 23 件（`features/`）と規模順アプリ 5 件（`apps/`）。すべて CI でパース・型検査・ビルドを検証。
- `tests/`: 全 example の動作保証テスト。
- `guide/`: はじめに・最初のアプリ・考え方・レシピ。
- `.claude/skills/`: `kumiki-author` / `kumiki-debug` / `kumiki-iterate` スキル。
- `design-notes/`: 設計の経緯とベンチマーク（学習コスト v1–v4、React 比トークン効率）を集約。
- **静的メソッド存在チェック (E0801)**: `obj.method(...)` がランタイム未実装のメソッド（綴り間違い、`Option.to-result` のような誤用、未実装の仕様メソッド）を呼ぶと `check` 段階で検出。実装集合は `@kumiki/compiler` の `KNOWN_METHODS`（codegen と同期）が唯一の正。以前 smoke 層でしか捕まらなかった `.to-result` 級のバグを layer 1 で先取りする。
- **`List.fold` / `Int`・`Float.parse` の修正**（iterate ループのデモ中に検出）: `fold` の codegen + runtime を実装、`Int.parse`/`Float.parse` を数値変換に修正（従来は文字列を返し合計等が壊れた）。例: `examples/features/24-fold.kumiki`, `examples/apps/06-expenses/`。

### Changed

- 1 reducer 1 書き込み規則を、ルート名粒度から **パス形状（lvalue shape）粒度**へ。`tasks[id].status` と `tasks[id].updatedAt` が共存可能に。
- ランタイム: dispose 後の遅延 effect 結果が DOM を触らないようガード（in-flight fetch 起因の `NotFoundError` を解消）。
- AST: `IfStmt` / `IfExpr` / `TileIf` のフィールドを `then`/`else` → `consequent`/`alternate` に改名。

### Notes

- experimental v0.1。言語・ランタイム・ツールは予告なく変わりうる。
