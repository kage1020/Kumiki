# はじめに

[English](./getting-started.md) · 日本語

## 必要なもの

- Node.js 22+
- pnpm

## セットアップ

```sh
git clone <this-repo>
cd new-js-framework
pnpm install
pnpm build
pnpm test     # 全パッケージのテストが緑になることを確認
```

## Strand プログラムを検査する

`.strand` ファイルをパース + 型検査する:

```sh
pnpm --filter @strand/cli exec tsx src/strand.ts check examples/apps/01-counter/app.strand
# → ok
```

エラーがあればコード付きで表示される（例: `E0103 undef-ref at 5:12: ...`）。意味は [../spec/errors.md](../spec/errors.md) を参照。

## ビルドして動かす

```sh
pnpm --filter @strand/cli exec tsx src/strand.ts build examples/apps/01-counter/app.strand ./out
# → Wrote ./out/index.html, app.js, runtime.js
```

`out/index.html` をブラウザで開けば動く。`app.js` は生成された純粋なロジック、`runtime.js` は DOM ランタイムである。

## エディタ / AI 連携（MCP）

`@strand/mcp` は検査・ビルド・編集・仕様検索を MCP ツールとして公開する。MCP クライアント設定例は [packages/mcp/README.md](https://github.com/kage1020/Strand/blob/main/packages/mcp/README.md) を参照。

## 次へ

[your-first-app.md](./your-first-app.md) で Counter を一から書く。
