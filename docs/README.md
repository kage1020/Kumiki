# @kumikijs/site

The Kumiki documentation site (VitePress). It serves `spec/`, `guide/`, and `examples/` as a single source, and includes an in-browser **Playground** (running the compiler + runtime in the browser) and **WebMCP** tools.

## How it works

The normative source lives at the repository root in `spec/` etc. Before the build, `scripts/sync-docs.mjs` copies them into `site/` (the copy destination is gitignored). This lets VitePress keep a single source while staying in its usual in-project layout.

## Development

```sh
pnpm --filter @kumikijs/site dev      # sync + dev server
pnpm --filter @kumikijs/site build    # sync + production build → site/dist
pnpm --filter @kumikijs/site preview
```

The Playground imports `@kumikijs/runtime/bundle?raw`, so the runtime bundle is required before building. Using `pnpm exec turbo run build --filter=@kumikijs/site` builds the dependencies (runtime/compiler) first automatically.

## Deploy (Cloudflare Pages → kumiki.kage1020.com)

CI ([`.github/workflows/deploy-site.yml`](../.github/workflows/deploy-site.yml)) deploys automatically on push to `main`. The following is required beforehand:

1. Create a Pages project `kumiki` in Cloudflare.
2. Register `CLOUDFLARE_API_TOKEN` (Pages edit permission) and `CLOUDFLARE_ACCOUNT_ID` in the repository's GitHub Secrets.
3. Add `kumiki.kage1020.com` to the Pages project's **Custom domains** (DNS sets up the CNAME automatically on the Cloudflare side).

For a manual deploy:

```sh
pnpm exec turbo run build --filter=@kumikijs/site
cd site && wrangler pages deploy   # uses pages_build_output_dir=dist from wrangler.jsonc
```
