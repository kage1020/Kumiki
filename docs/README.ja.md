# @kumikijs/site

Kumiki ドキュメントサイト（VitePress）。`spec/` `guide/` `examples/` `design-notes/` を単一ソースとして配信し、ブラウザ内 **Playground**（コンパイラ + ランタイムをブラウザで実行）と **WebMCP** ツールを備える。

## 仕組み

正規ソースはリポジトリルートの `spec/` 等にある。ビルド前に `scripts/sync-docs.mjs` がそれらを `site/` 内へコピーする（コピー先は gitignore）。これにより VitePress は通常の in-project 構成のまま、単一ソースを保てる。

## 開発

```sh
pnpm --filter @kumikijs/site dev      # 同期 + dev サーバ
pnpm --filter @kumikijs/site build    # 同期 + 本番ビルド → site/dist
pnpm --filter @kumikijs/site preview
```

Playground は `@kumikijs/runtime/bundle?raw` を取り込むため、ビルド前に runtime バンドルが必要。`pnpm exec turbo run build --filter=@kumikijs/site` を使えば依存（runtime/compiler）が自動で先にビルドされる。

## デプロイ（Cloudflare Pages → kumiki.kage1020.com）

CI（[`.github/workflows/deploy-site.yml`](../.github/workflows/deploy-site.yml)）が `main` への push で自動デプロイする。事前に以下が必要:

1. Cloudflare で Pages プロジェクト `kumiki` を作成。
2. リポジトリの GitHub Secrets に `CLOUDFLARE_API_TOKEN`（Pages 編集権限）と `CLOUDFLARE_ACCOUNT_ID` を登録。
3. Pages プロジェクトの **Custom domains** に `kumiki.kage1020.com` を追加（DNS は Cloudflare 側で CNAME を自動設定）。

手動デプロイは:

```sh
pnpm exec turbo run build --filter=@kumikijs/site
cd site && wrangler pages deploy   # wrangler.jsonc の pages_build_output_dir=dist を使用
```
