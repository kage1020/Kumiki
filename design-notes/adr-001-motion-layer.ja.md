# ADR 001 — `motion` は `theme` と同格のトップレベル定義（8 番目のレイヤーではない）

[English](./adr-001-motion-layer.md) · 日本語

- **ステータス:** Accepted（2026-06-03）
- **マイルストーン:** v0.2 M5（[roadmap](./roadmap-v0.2.ja.md)）
- **Spec:** [style.ja.md §4.9](../spec/style.ja.md)、[language.ja.md §1.1](../spec/language.ja.md)

## 背景

v0.1 は閉じた 3 つの `transition` トークン（`fade` / `slide-up` / `slide-down`）を `when` でトグルされる tile に自動適用する（[style.ja.md §4.9](../spec/style.ja.md)）。v0.2 M5 は、再利用可能で任意（ただし閉じた文法）のアニメーション — スピナー、パルス、独自の入退場 — を、生 CSS の抜け穴を開けずに（[style.ja.md §4.10](../spec/style.ja.md) の不変条件）宣言する `motion` 機能を追加する。

ロードマップは、実装*前*に ADR で記録すべき判断を 1 つ挙げていた：**`motion` を 7 レイヤーモデルの 8 番目のレイヤーにするか、それとも別物か？**（[roadmap M5](./roadmap-v0.2.ja.md)）。

## 決定

**`motion` は `theme` をそっくり手本とするトップレベル定義 — 名前付きで再利用可能な純粋に表示用の定義であり、「7 レイヤー」には数えない。**

決め手は、**7 レイヤーモデルが既にロジック/データ/UI のコアだけを記述している**こと、そして Kumiki が既にその外側に表示用・メタの定義種を持つことだ：

- [language.ja.md §1.1.1](../spec/language.ja.md) はちょうど 7 つの*レイヤー* — `type` / `slot` / `effect` / `reducer` / `tile` / `fn` / `app` — を挙げ、その EBNF `definition ::= type-def | … | app-def` は `theme-def` も `test-def` も**完全に省いている**。どちらも実在のトップレベル定義であるにもかかわらず。
- `theme` は `store.ts` の `LAYER_OF` に項目を持つがレイヤー表には無い。`test` は [testing.ja.md §8.1](../spec/testing.ja.md) で「6 番目のレイヤー」と緩く呼ばれるが本番ビルドからは除外される。

つまり「7 レイヤー」とは **AI が振る舞いを表現するために学ぶ意味論的コア**だ。`theme`・`test`・そして `motion` は、その 7 つの傍らに在って振る舞いの学習対象を膨らませない**補助的な宣言語彙**（デザイントークン、振る舞いアサーション、アニメーション）である。これは [rationale](./rationale.md) の非ゴール（「マクロ/DSL 拡張なし。AI の学習対象を単一に保つ」）を維持する — `motion` は新しいロジック構文ではなく*閉じた表示用語彙*を加える、`theme` がそうしたのと全く同じに。

ゆえに `motion` は：
- body が**レコードリテラル**であるトップレベル `motion Name = { … }` 定義を用い、`theme` と同じ `parseThemeRecord` 経路でパースされる（その値はリテラル/ネストレコードのみ — **purity は構文的に保証**される：slot 参照や effect 呼び出しを内部に書けないので M5 AC4 を構成的に満たす）。
- 任意の tile から `motion` プロップで参照される（`tile Loader = icon(name="spinner") {motion: "Spin"}`）。既に `transition` プロップが在るのと同じ場所。
- `spec/style.md`（`transition` の隣）に記述し、`spec/language.md` に `theme` / `test` / `motion` が 7 レイヤー外の補助定義である旨の短い注記を加える（既存の EBNF の欠落を解消）。

### 却下した代替案

- **正式な 8 番目のレイヤーに昇格。** 却下：純粋に表示用の関心事のためにコアの学習対象と言語の看板アイデンティティを膨らませる。一貫性のため（同じく表示用の）`theme` も昇格を迫られる。7 レイヤーモデルは*振る舞い*の話であり、アニメーションは装飾だ。
- **新キーワードを足さず `theme`/`style` に埋める。** 却下：`theme.animations` ブロックは 2 つの異なる関心事（デザイントークン vs 時間ベースの振る舞い）を混ぜ、motion に参照や `kumiki view` のための第一級の名前を与えず、theme 検証を複雑にする。名前付きの兄弟定義なら motion は静的に特定でき AI が編集しやすい。

## motion 文法（閉じている、生 CSS 無し）

```kumiki
motion Spin = {
    keyframes: {from: {rotate: 0}, to: {rotate: 360}},
    duration:  "normal",      # "fast" | "normal" | "slow"、または正の Int（ms）
    easing:    "linear",      # linear | ease | ease-in | ease-out | ease-in-out
    iteration: "infinite",    # 正の Int、または "infinite"
    direction: "normal"       # normal | reverse | alternate | alternate-reverse
}
```

- **`keyframes`**（必須）：`from` と `to` を持つレコード。各々は**閉じたアニメ可能プロパティ集合**上のレコード：
  | プロパティ | 単位 | CSS 対象 |
  |---|---|---|
  | `opacity` | 0..1 | `opacity` |
  | `translate-x` / `translate-y` | px（数値） | `transform: translateX/Y(…px)` |
  | `scale` | 数値 | `transform: scale(…)` |
  | `rotate` | deg（数値） | `transform: rotate(…deg)` |

  1 つのストップ上の複数 transform プロパティは単一の `transform` に合成される。未知プロパティはコンパイルエラー（**E0401**）。
- **タイミング**フィールドは任意（既定：`duration:"normal"`、`easing:"ease"`、`iteration:1`、`direction:"normal"`）。閉じた集合外の値はコンパイルエラー（**E0402**）。
- `keyframes` の欠落/不正（`from`/`to` 無し、非レコード）は **E0403**。
- 未定義の motion を指す tile プロップ `motion: "X"` は **E0107 `undef-motion`**（名前解決帯）。

### Codegen & runtime

`codegen` は `_themes` の隣に `_motions` レジストリを emit し `App.motions` を設定する。mount 時に runtime は `<style id="kumiki-motions">` を 1 つ注入し、motion `M` ごとに `@keyframes kumiki-motion-M { … }` と `.kumiki-motion-M { animation: … }` 規則を入れる（既存の `transition` 用 `kumiki-animations` ブロックを踏襲）。`applyContainerProps` / text props は tile が `motion: "M"` を持つとき `kumiki-motion-M` クラスを付与する。style ブロックの末尾は `@media (prefers-reduced-motion: reduce) { .kumiki-motion-*, .kumiki-anim { animation: none !important } }`（M5 AC5）。keyframes は生成クラス名にスコープされ runtime が注入するので [style.ja.md §4.10](../spec/style.ja.md) の「グローバル CSS 無し」不変条件は保たれる。motion はトグル/重ねられた tile 上の単なるクラスなので `when(...)` や `overlay`（M2）と合成される（AC3）。

## 受け入れ基準（M5）

- AC1: `motion N = {keyframes, …}` がパースされ、文法は閉じている（閉じたプロパティ＋タイミング集合、生 CSS 文字列無し）。集合外のプロパティ/タイミング → E0401/E0402、不正な keyframes → E0403。
- AC2: motion を名前参照する tile が、生成されたスコープ済みクラス経由で runtime 適用される。未定義名は E0107。
- AC3: 入退場 motion が `when(...)` と `overlay`（M2）と合成される。
- AC4: motion は純粋に表示用 — slot の読み書きや effect emit はできない（構文的：body はリテラルレコード）。
- AC5: `prefers-reduced-motion: reduce` で motion（と v0.1 transition）を無効化。`spec/style.md` に記述。
- AC6: 新 `examples/features/` example（スピナー＋アニメ付きモーダル）が check + build + smoke を通過。jsdom が観測できない部分は `@kumikijs/e2e` ブラウザシナリオで覆う。
- AC7: 本 ADR が決定を記録。`spec/style.md` に motion 文法を加え「v0.2 の `motion` レイヤーで導入」文を除去。`spec/language.md` に補助定義の区別を注記。

## 繰り延べ（後続、ここで追跡）

- **多段 keyframes**（`{0: …, 50: …, 100: …}` パーセンテージオフセット） — v0.2 motion は `from`/`to` のみ。スピナー・パルス・フェード・スライドを覆う。パーセンテージストップは文法に数値レコードキーが要る。
- **アニメ可能プロパティの拡充**（色/背景の補間、`blur`、`skew`、軸別 scale） — 閉じた集合は意図的に小さく始める。
- **`transition` の実装エンジンとしての motion** — v0.1 `transition` トークンは別の組込ブロックのまま。motion へ統一するのは後のクリーンアップ。

## 帰結

- キーワードを足さない新トップレベル形が 1 つ（`motion`、`theme` と同様に dispatch）、新 runtime style ブロックが 1 つ、新エラーコードが 4 つ（E0107, E0401–E0403）。7 つのロジックレイヤーは不変。
- `spec/language.md` が明確化され、長く潜在していた `theme`/`test` の EBNF 欠落が説明される。
