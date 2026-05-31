# Changelog

[English](./CHANGELOG.md) · 日本語

形式は [Keep a Changelog](https://keepachangelog.com/) に準拠し、[Semantic Versioning](https://semver.org/) を採用する。

## [Unreleased]

### Planned — v0.2

スコープ・設計・受け入れ基準：[design-notes/roadmap-v0.2.ja.md](./design-notes/roadmap-v0.2.ja.md)。spec が既に「planned for v0.2」と明記している 5 項目を、独立したマイルストーン（M1–M5）として出荷する：

- **M1 — `stop-timer(name)`**：名前付きタイマーと reducer からの明示停止（`spec/lifecycle.md §7.1.5`）。
- **M2 — `overlay` builtin**：モーダル / トースト / ドロップダウン用の z 軸重ね（`spec/style.md §4.4.3`）。
- **M3 — プラグインによる capability 登録**：コンパイラを fork せず独自 capability + effect を登録する宣言的マニフェスト（`spec/stdlib.md §2.5`）。
- **M4 — `kumiki fix --auto-patch <test-name>`**：`fix` を typecheck エラーからテスト失敗まで拡張し、ソースパッチを提案・適用（`spec/testing.md §8.7.1`）。
- **M5 — `motion` レイヤー**：グローバル CSS の抜け穴のない、宣言的でスコープされた transition / keyframes（`spec/style.md §4.9`）。

### Added

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
