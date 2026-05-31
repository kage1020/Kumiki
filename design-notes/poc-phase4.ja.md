# PoC Phase 4 — テーマ・スタイル・a11y・エラー境界

[English](./poc-phase4.md) · 日本語

## 14.1 ゴール

Phase 1〜3 で「動く SPA」までを通したので、Phase 4 では **見た目** と **堅牢さ** を仕上げる。

サンプルは Counter / TodoMVC / Blog SPA をそのまま使い、追加機能でビジュアル / a11y / 例外耐性を改善する。

## 14.2 スコープ

| カバー | 詳細 |
|---|---|
| Theme | `theme X = {...}` を parse + AST + codegen + runtime に通し、`@colors.primary` 形式・短縮 prop 形式（`bg: "primary"`）の両方が theme から解決される。slot 経由でテーマ切替（ダークモード）も可能 |
| 状態スタイル | `hover: {...}` / `focus: {...}` / `disabled: {...}` を pseudo-class 動的 CSS で適用 |
| Responsive | スタイル prop に `{base, sm, md, lg, xl}` 形式を受けて media query で切替 |
| a11y 静的検査 | typecheck で `button` に `text`/`aria-label`、`image` に `alt`、`link` に内側テキスト、`form` 内 `input` に `label` を警告。`--strict-a11y` でエラー化 |
| エラー境界 | `tile X error-boundary = Fallback` を runtime が捕捉。配下 render で例外発生時に `Fallback(panicInfo)` を描画 |
| アニメーション | `transition: "fade" / "slide-up" / "slide-down"`、`transition-duration: "fast" / "normal" / "slow"` を `when` 切替に自動適用 |

Phase 4 で **扱わない**：
- 任意 CSS の自由書き
- カスタム keyframes
- Web Animations API への低レベル access
- focus trap / a11y-tree の動的計算

## 14.3 受け入れ基準（AC）

### AC-Theme
- `theme Dark = {...}` を parse、codegen が `_theme = {...}` として runtime に渡す
- `box(...) {bg: "primary"}` で `box` の background が `theme.colors.primary` の値になる
- `app.theme = Dark` 指定で全体に Dark テーマが適用
- `slot themeName : Text = "Light"` + `app.theme = themeName` で slot 切替で再テーマ
- `prefers-dark()` 関数で OS 設定の検出（reducer 内で呼べる）

### AC-状態スタイル
- `button(text="X") {bg: "primary", hover: {bg: "primary-dark"}}` で hover 時に背景色が変わる
- `disabled` 状態の自動 styling
- `focus` 状態の outline 反映

### AC-Responsive
- `column(...) {gap: {base: "sm", md: "lg"}}` で viewport 幅で gap が変わる
- breakpoint はテーマの `breakpoints` から取る

### AC-a11y
- `button(text="")` → 警告 E0701
- `image(src="x")` で alt なし → 警告 E0702
- `link(to="/x")` の内側テキストなし → 警告 E0703
- `--strict-a11y` でこれらがエラーになりビルド失敗

### AC-エラー境界
- 任意 tile の描画で `panic("oops")` 相当が起きると `Fallback(PanicInfo)` が描画される
- 境界外の他 tile は影響なく描画される

### AC-アニメーション
- `when(modalOpen, Modal() {transition: "slide-up"})` が表示時にスライドアップ
- duration の 3 段階（fast=150ms, normal=300ms, slow=600ms）

### AC-E2E
- jsdom 上で navigate / fetch mock の Blog SPA E2E 動作
- Counter / TodoMVC に theme を適用してブラウザで目視

## 14.4 実装順序

| step | 内容 | 検証 |
|---|---|---|
| 1 | Theme parse + AST + codegen + runtime | snapshot + ブラウザ |
| 2 | 短縮 prop の theme 解決 | snapshot |
| 3 | 状態スタイル (hover/focus/disabled) | ブラウザ |
| 4 | Responsive breakpoints | ブラウザ |
| 5 | a11y 検査 | typecheck test |
| 6 | Error boundary runtime | runtime test + jsdom |
| 7 | アニメーション | ブラウザ |
| 8 | Blog SPA E2E + 既存例 theme 化 | jsdom |

## 14.5 設計上の判断

| 判断 | 理由 |
|---|---|
| Theme tokens は **コンパイル時** に展開しない | slot 切替でテーマ切換できるよう runtime resolve |
| 状態スタイルは動的 CSS 注入 (data-strand-id + pseudo-class) | inline style で hover を書く方法はないので |
| Responsive は viewport size を watch しない | `matchMedia` でブレークポイント別 class を切替 |
| a11y は警告のデフォルト | 既存例の互換性のため。`--strict-a11y` でエラー化 |
| エラー境界は try/catch ベース | render 中の例外を捕捉、tile 階層単位 |
| アニメーション 3 種固定 | カスタムを Phase 5 へ |

## 14.6 完了の定義

- AC すべて pass
- 既存 46 件 + Phase 4 で追加するテスト (theme/state/responsive/a11y/error-boundary/animation) も全部 pass
- ブラウザで Counter / TodoMVC / Blog SPA の見た目が改善されているのを目視
