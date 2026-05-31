# Kumiki v0.2 ロードマップ

[English](./roadmap-v0.2.md) · 日本語

このドキュメントは v0.2 マイルストーンのスコープ・設計方針・受け入れ基準（AC）を定義する。機能ごとの詳細設計は `spec/` に、動く例は `examples/` に置く、その計画側の対応物である。実装はリポジトリの TDD フローに従う：**設計 → AC → テスト → 実装 → 反復**（[CONTRIBUTING](./CONTRIBUTING.ja.md) 参照）。

## ゴール

v0.1 は AI が 1300 LOC の SaaS 級 SPA をワンショットで書く水準に到達した（[learning-cost-v4](./learning-cost-v4.ja.md)）。v0.2 は **spec 自身が「planned for v0.2」と明記している 5 つのギャップ**を埋め、言語が先送りをやめ、`spec/` から先送り文言を取り除く。根本的な再設計はしない。各項目は加算的で独立して出荷できる。

5 項目と spec 上の出典：

| # | 項目 | spec 出典 | 規模 |
|---|---|---|---|
| 1 | `stop-timer(name)` — timer の明示停止 | [lifecycle.md §7.1.5](../spec/lifecycle.ja.md) | S |
| 2 | `overlay` builtin — z 軸重ね | [style.md §4.4.3](../spec/style.ja.md) | S |
| 3 | プラグインによる capability 登録 | [stdlib.md §2.5](../spec/stdlib.ja.md) | M |
| 4 | `kumiki fix --auto-patch <test-name>` — テスト失敗からの修正 | [testing.md §8.7.1](../spec/testing.ja.md) | M |
| 5 | `motion` レイヤー — 任意の transition / keyframes | [style.md §4.0, §4.9](../spec/style.ja.md) | L |

## 順序

独立した PR として、リスクの小さい順に出荷する。各 PR が green になってから次に着手する：

```
M1  stop-timer            (S, runtime + parser + codegen)
M2  overlay               (S, parser + codegen + runtime レイアウト)
M3  plugin capabilities   (M, typecheck + runtime dispatch + manifest)
M4  fix --auto-patch      (M, cli + test-runner 連携)
M5  motion レイヤー        (L, spec doc + parser + codegen + runtime)
```

M1–M2 は機械的で、ツールチェーンへの確信を先に固める。M5 は最大面積なので最後。M2（`overlay`）が入っていると恩恵が大きい（モーダル／トーストが motion の主たる消費者）。

各マイルストーンは完了時に標準ゲートを満たすこと：`pnpm exec turbo run typecheck test lint build` が green、新規 example が `check` + `build` + `smoke` を通過、該当 `spec/*.md` から「planned for v0.2」の一文が消える、`CHANGELOG` で当該項目が *Planned* → *Added* へ移る。

---

## M1 — `stop-timer(name)`

**設計.** 現状 `timer(d)` は `setInterval` ベースで `app` の dispose 時のみ解除される（[lifecycle.md §7.1.5](../spec/lifecycle.ja.md)）。v0.2 は名前付きタイマーのレジストリを追加し、reducer が特定の繰り返しタイマーを停止できるようにする。トリガー `timer(d)` に任意の名前を付与でき（`timer(1s, name=tick)`）、reducer から `emit stop-timer(tick)`（または `stop-timer(tick)` 文）でその interval を解除する。名前はアプリにローカルで静的に既知なので、停止対象が宣言済みの `timer(... name=...)` トリガーに対応しているかをコンパイラが検証できる。

**受け入れ基準.**
- AC1: `timer(d, name=N)` トリガーが名前付き interval を登録する。`N` は裸の識別子で、アプリ内で一意（重複は新規 `E07xx`）。
- AC2: reducer からの `stop-timer(N)` が interval `N` を解除する。以降の tick は発火しない。
- AC3: 未宣言のタイマー名を参照する `stop-timer(N)` はコンパイルエラー（`E06xx`/`E07xx` 帯の新コード、`spec/errors.md` に登録）。
- AC4: 停止したタイマーは再マウントでのみ再開できる（暗黙の自動再開はしない）。lifecycle に明記。
- AC5: `app` dispose 時に全名前付きタイマー（稼働中・停止中問わず）が解除される（リークなし）。runtime テストで検証。
- AC6: 新規 example `examples/features/NN-stop-timer.kumiki`（例：0 で止まるカウントダウン）が check + build + smoke を通過。停止後に slot が進まないことを scenario でアサート。

**影響範囲.** `compiler`（`name=` の lexer/parser、typecheck の名前検証、codegen emit）、`runtime`（名前付き interval レジストリ + 解除）、`spec/lifecycle.md` + `spec/errors.md`、`examples/features/`、`tests/`。

---

## M2 — `overlay` builtin

**設計.** z 軸重ね用のレイアウト builtin として `overlay(...children)` を追加する（[style.md §4.4.3](../spec/style.ja.md)）。子を z 軸に重ねる positioned コンテナをレンダリングし（最初の子がベース層、後続の子がその上に重なる）、モーダル・トースト・ドロップダウン・ツールチップの正準的な土台となる。props：`align`（重ねる子の配置：`center` / `top` / `bottom` / 各コーナー）と標準スタイル props。既存の `when(...)`/`transition` の表示切替機構と合成できるので、M5 の motion で overlay の入退場をアニメーションできる。

**受け入れ基準.**
- AC1: `overlay(Base, Layer1, Layer2)` が重なりコンテキストを生成。`Base` は通常フロー、後続の子はその上に絶対配置。
- AC2: `align` prop が重ねる子を配置（既定 `center`）。不正トークンは既存のスタイル prop 検証エラー。
- AC3: `when(open, Modal())` で切り替わる重ね子が正しく mount/unmount し、ベース層のレイアウトをずらさない。
- AC4: reset/埋め込み CSS により overlay は自己完結（グローバル CSS の抜け穴なし — [style.md §4.10](../spec/style.ja.md) と整合）。
- AC5: 新規 example `examples/features/NN-overlay.kumiki`（コンテンツ上のモーダル）が check + build + smoke を通過。
- AC6: `spec/style.md` の「`box` に `position`、または将来の `overlay` builtin を使う」注記を、出荷した仕様に置き換える。

**影響範囲.** `compiler`（parser の builtin 登録、positioned DOM + CSS への codegen）、`runtime`（mount/レイアウト）、`spec/style.md`、`examples/features/`、`tests/`。

---

## M3 — プラグインによる capability 登録

**設計.** 現状、未登録の capability を `app.caps` に書くとコンパイルエラーで、標準セットは固定（[stdlib.md §2.5](../spec/stdlib.ja.md)）。v0.2 は **capability マニフェスト**を導入し、コンパイラを fork せずにプロジェクトが追加 capability とその effect シグネチャを登録できるようにする。マニフェストは宣言的なファイル（例：`kumiki.caps.json` / ワークスペースのフィールド）で、CLI とコンパイラが解決する。capability 名 → それが認可する effect 記述子の形、を対応づける。登録された capability は `app.caps` 検証を通過し、その effect が emit 可能になる。これは**宣言的な登録であって任意コードではない** — 「AI の学習対象を広げるマクロ/プラグインは認めない」という非ゴール（[rationale](./rationale.ja.md)）と整合する：プラグインは*capability 境界*を足せるが、新しい構文は足せない。

**受け入れ基準.**
- AC1: マニフェストで宣言した capability が `app.caps` でコンパイルエラーなく受理される。
- AC2: 登録 capability に紐づく effect が reducer から emit でき、capability 境界で dispatch される（標準 effect と同様 scenario でモック可能）。
- AC3: 標準セットにも**マニフェストにも**ない capability は依然コンパイルエラー（安全性プロパティを維持）。
- AC4: マニフェストのスキーマを検証。不正なマニフェストは明確な CLI エラー（クラッシュではない）。
- AC5: scenario runner が登録 effect を決定的にモック（標準 effect と同じ契約）し、`run` トレースの再現性を保つ。
- AC6: `examples/features/` 配下に新規例（独自 capability、例：ドメイン固有 effect）+ マニフェストを追加し、check + build + smoke + scenario を通過。
- AC7: `spec/stdlib.md` の「v0.2 でプラグイン経由を予定」の一文を登録仕様に置き換える。

**影響範囲.** `compiler`（caps 検証がマニフェストを読む）、`runtime`/`scenario`（独自 effect の dispatch + モック）、`cli`（マニフェスト解決）、`mcp`（マニフェスト認識の公開）、`spec/stdlib.md` + `spec/http.md`/`spec/lifecycle.md`（capability ドキュメント）、`examples/`、`tests/`。

---

## M4 — `kumiki fix --auto-patch <test-name>`

**設計.** 現状 `kumiki fix` は固定の **typecheck** エラー集合（`E0102`–E0105 の名前タイポ、`E0001` の `/404` 欠落）に対してのみ `packages/cli/src/fix.ts` の `planFixes` でパッチを提案する。v0.2 は `fix` を**テスト失敗**まで拡張する（[testing.md §8.7.1](../spec/testing.ja.md)）：runner から失敗した `<test-name>` を受け取り、expected と actual の diff（および取得可能なら scenario トレース / smoke エラー）を解析して `.kumiki` ソースへのパッチを提案する。既存の `AutoPatch { code, message, description, apply }` 形を再利用し、パッチの入力源を「コンパイラのエラー列」から「テスト失敗レポート」へ広げる。`--auto-patch` は適用後に当該テストを再実行して green を確認する（既存の apply→再 check ループと同様）。

**受け入れ基準.**
- AC1: `kumiki fix --auto-patch <test-name>` が当該テストを解決・実行し、失敗時に ≥1 の候補パッチを出す（または diff 付きで明確に「auto-patch なし」）。
- AC2: snapshot/表示の不一致（expected tile tree ≠ actual）に対し、提案パッチが原因の tile/reducer を対象とし、適用でそのテストが通る。
- AC3: 既知エラーコードとして現れる runtime/smoke 失敗には、既存の `planFixes` 経路を再利用。
- AC4: `--auto-patch` なし（dry-run）では提案パッチを表示しファイルを変更しない（現行 `fix` の dry-run 挙動と整合）。
- AC5: 適用後に当該テストを再実行し、通ったか・他テストが退行したかを出力。
- AC6: `tests/`（または `packages/cli/test/`）に回帰テスト：失敗テスト → 提案 → 適用 → 通過、をカバー。
- AC7: `spec/testing.md §8.7.1` の「planned for v0.2」の一文を出荷挙動に置き換える。

**影響範囲.** `cli`（`fix.ts` 拡張、test-runner フック）、`runtime`（`fix` が消費する構造化された失敗/トレースの公開）、`spec/testing.md`、`tests/`。

---

## M5 — `motion` レイヤー

**設計.** v0.1 は `when` で切り替わる tile に自動適用される閉じた `transition` トークン集合（`fade` / `slide-up` / `slide-down`）のみを提供する（[style.md §4.9](../spec/style.ja.md)）。v0.2 は任意の transition と keyframe アニメーションのための専用の宣言的 **`motion` レイヤー**を導入する。その際 Kumiki の「グローバル CSS なし、装飾はすべて自己完結」という不変条件を保持する（[style.md §4.10](../spec/style.ja.md)）。`motion` 定義は再利用可能なアニメーション（keyframes + タイミング）に名前を付け、tile prop（`motion=Spin` 形式）から参照する — 自由形式 CSS と違い、静的に位置特定でき AI が編集できる状態を保つ。本項目は 7 レイヤーモデルに**第 8 レイヤーを追加し得る**唯一の項目である。その判断（新レイヤー vs `style` の拡張）は M5 最初の設計タスクであり、実装前に本ディレクトリの ADR として記録すること。

**受け入れ基準.**
- AC1: `motion` 定義が名前付き keyframes + タイミング（duration / easing / iteration / direction）を、小さく閉じた文法で宣言（生 CSS 文字列の抜け穴なし）。
- AC2: tile が motion を名前参照し、runtime がグローバル CSS を漏らさず適用（tile にスコープ、§4.10 と整合）。
- AC3: 入退場 motion が `when(...)` と `overlay`（M2）と合成 — モーダルが入退場アニメーションできる。
- AC4: motion は純粋に表示用：slot の読み書きや effect emit はできない（レイヤー純粋性を維持、typecheck で検証）。
- AC5: `prefers-reduced-motion` を尊重（a11y）、`spec/style.md` に明記。
- AC6: 新規 `examples/features/` 例（例：スピナー + アニメーションするモーダル）が check + build + smoke を通過。jsdom で観測できないアニメーションはブラウザ層（`@kumiki/e2e`）で検証。
- AC7: ADR がレイヤー vs 拡張の判断を記録。`spec/` に motion 文法を追加。§4.9 の「v0.2 の `motion` レイヤーで導入」の一文を置き換える。

**影響範囲.** `spec/style.md`（レイヤー追加なら `spec/language.md` も）+ `design-notes/` の新規 ADR、`compiler`（レイヤーの lexer/parser、純粋性 typecheck、スコープ CSS/keyframes への codegen）、`runtime`（motion の適用/スコープ）、`examples/features/`、`@kumiki/e2e`、`tests/`。

---

## バージョン方針

- 現在の `main` が **v0.1 ベースライン**（ワークスペース版 `0.1.0`、未タグ — git タグはまだ存在しない）。
- v0.2 作業は上記マイルストーンを独立 feature ブランチで投入する。包括的な CHANGELOG エントリは `## [0.2.0]` とし、*Planned* リストをマイルストーンごとに *Added* へ変換する。
- 5 マイルストーンすべてが green になったら、ワークスペース版を `0.2.0` に上げ `v0.2.0` をタグ付けする。
- SemVer 注記：1.0 未満の experimental — 加算的機能は minor バンプ。`spec/` からの先送り機能の削除は破壊的ではない（capability を増やすのみ）。

## v0.2 の非ゴール

[rationale](./rationale.ja.md) から不変：React 相互運用なし、人間ファースト DX なし、マクロ/任意 DSL 拡張なし（M3 のマニフェストは capability 境界を足すが**構文は足さない**）、動的型なし、DOM のみ。motion（M5）は生 CSS の抜け穴を開けない。
