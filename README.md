# Strand

**AI が書き・直し・並列に触ることを最優先に設計した、宣言的 Web アプリ言語とランタイム（experimental, v0.1）**

```strand
slot count : Int = 0

reducer inc on=ui.click(IncBtn) do= count := count + 1

tile IncBtn = button(text="+1", onClick=inc)
tile App    = column(heading("Count: " + count.show), IncBtn)

app Counter
    caps   = []
    routes = {"/" -> App, "/404" -> App}
    init   = []
```

Strand は JSX・Hooks・依存配列・Provider といった「人間の認知に最適化された」装置を持たない。代わりに **7 レイヤ**（type / slot / effect / reducer / tile / fn / app）の独立した定義の集合としてアプリを表す。構文オーバーヘッドが小さく、定義同士の依存が明示的で、AI が安全に部分編集できる。

> ⚠️ **experimental**。言語・ランタイム・ツールは変わりうる。本番利用は想定していない。

## なぜ Strand か

クロスベンダーの実測で、LLM は仕様書だけを与えられた状態から Strand アプリを 1300 行規模まで書けることを確認している（[design-notes/learning-cost-v4.md](./design-notes/learning-cost-v4.md)）。React 比でトークン効率も高い（[design-notes/benchmark.md](./design-notes/benchmark.md)）。

## リポジトリ構成

| ディレクトリ | 役割 |
|---|---|
| [`spec/`](./spec/) | **正規仕様**（normative）。言語・stdlib・routing・style・forms・http・lifecycle・runtime・ai-edit・errors |
| [`guide/`](./guide/) | チュートリアルと how-to（はじめに / 最初のアプリ / 考え方 / レシピ） |
| [`examples/`](./examples/) | 網羅的な実例。`features/`（機能別ミニマル）+ `apps/`（規模順の完成アプリ） |
| [`packages/`](./packages/) | 実装。`compiler` / `runtime` / `cli` / `mcp` |
| [`tests/`](./tests/) | 横断テスト。全 example のパース・型検査・ビルドを保証 |
| [`design-notes/`](./design-notes/) | 設計の経緯とベンチマーク記録 |

## クイックスタート

```sh
pnpm install
pnpm build          # 全パッケージをビルド
pnpm test           # 全テスト

# Strand プログラムを検査・ビルド
pnpm --filter @strand/cli exec tsx src/strand.ts check examples/apps/01-counter/app.strand
pnpm --filter @strand/cli exec tsx src/strand.ts build examples/apps/01-counter/app.strand ./out
```

はじめての人は [guide/getting-started.md](./guide/getting-started.md) → [guide/your-first-app.md](./guide/your-first-app.md) へ。

## パッケージ

| パッケージ | 内容 |
|---|---|
| [`@strand/compiler`](./packages/compiler/) | lexer・parser・typechecker・codegen |
| [`@strand/runtime`](./packages/runtime/) | DOM ランタイム（signal graph・mount・dispatch） |
| [`@strand/cli`](./packages/cli/) | `strand` コマンド（build / check / list / view / add / replace / remove / rename / fix） |
| [`@strand/mcp`](./packages/mcp/) | MCP サーバー。コンパイラと AI 編集・仕様検索を MCP ツールとして公開 |

## 運用モデル

このリポジトリは「**見ればすべての疑問が解決する**」状態を目指す。質問・issue・バグ報告には、原則として **examples と tests を足すことで答える**。壊れた例は CI で弾かれる（[tests/](./tests/)）。詳しくは [CONTRIBUTING.md](./CONTRIBUTING.md)。

## ライセンス

[Apache-2.0](./LICENSE)。著作権表示は [NOTICE](./NOTICE) を参照。
