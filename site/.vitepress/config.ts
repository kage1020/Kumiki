import kumikiGrammar from "@kumikijs/syntax";
import { defineConfig } from "vitepress";

// Docs are synced into this project root by scripts/sync-docs.mjs (run before
// dev/build). The single source of truth stays at the repo root (../spec, ...).
// English pages come from the `*.md` files; Japanese pages are generated from
// their `*.ja.md` siblings into `site/ja/` and served as the `ja` locale.
export default defineConfig({
  title: "Kumiki",
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
  ],
  cleanUrls: true,
  ignoreDeadLinks: true,
  markdown: {
    // Real Shiki grammar for Kumiki, shipped by @kumikijs/syntax.
    languages: [kumikiGrammar],
  },
  themeConfig: {
    logo: { light: "/kumiki-mark.svg", dark: "/kumiki-mark-dark.svg" },
    socialLinks: [{ icon: "github", link: "https://github.com/kage1020/Kumiki" }],
    search: { provider: "local" },
  },
  locales: {
    root: {
      label: "English",
      lang: "en",
      description:
        "A declarative web app language designed first and foremost for AI to write, edit, and touch in parallel",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/guide/getting-started" },
          { text: "Spec", link: "/spec/" },
          { text: "Examples", link: "/examples/" },
          { text: "Playground", link: "/guide/playground" },
          { text: "Design Notes", link: "/design-notes/" },
        ],
        sidebar: {
          "/guide/": [
            {
              text: "Guide",
              items: [
                { text: "Getting Started", link: "/guide/getting-started" },
                { text: "Your First App", link: "/guide/your-first-app" },
                { text: "Thinking in Kumiki", link: "/guide/thinking-in-kumiki" },
                { text: "Recipes", link: "/guide/recipes" },
                { text: "Playground", link: "/guide/playground" },
              ],
            },
          ],
          "/spec/": [
            {
              text: "Spec (normative)",
              items: [
                { text: "Overview", link: "/spec/" },
                { text: "Language Core", link: "/spec/language" },
                { text: "Standard Library", link: "/spec/stdlib" },
                { text: "Routing", link: "/spec/routing" },
                { text: "Style", link: "/spec/style" },
                { text: "Forms", link: "/spec/forms" },
                { text: "HTTP / Storage", link: "/spec/http" },
                { text: "Lifecycle", link: "/spec/lifecycle" },
                { text: "Runtime", link: "/spec/runtime" },
                { text: "AI Editing", link: "/spec/ai-edit" },
                { text: "Testing", link: "/spec/testing" },
                { text: "Error Codes", link: "/spec/errors" },
              ],
            },
          ],
          "/examples/": [
            {
              text: "Examples",
              items: [
                { text: "Overview", link: "/examples/" },
                { text: "Feature Catalog", link: "/examples/features/" },
              ],
            },
          ],
          "/design-notes/": [{ text: "Design Notes", link: "/design-notes/" }],
        },
      },
    },
    ja: {
      label: "日本語",
      lang: "ja",
      description:
        "AI が書き・直し・並列に触ることを最優先に設計した宣言的 Web アプリ言語",
      themeConfig: {
        nav: [
          { text: "ガイド", link: "/ja/guide/getting-started" },
          { text: "仕様", link: "/ja/spec/" },
          { text: "例", link: "/ja/examples/" },
          { text: "Playground", link: "/ja/guide/playground" },
          { text: "設計ノート", link: "/ja/design-notes/" },
        ],
        sidebar: {
          "/ja/guide/": [
            {
              text: "ガイド",
              items: [
                { text: "はじめに", link: "/ja/guide/getting-started" },
                { text: "最初のアプリ", link: "/ja/guide/your-first-app" },
                { text: "Kumiki の考え方", link: "/ja/guide/thinking-in-kumiki" },
                { text: "レシピ", link: "/ja/guide/recipes" },
                { text: "Playground", link: "/ja/guide/playground" },
              ],
            },
          ],
          "/ja/spec/": [
            {
              text: "仕様 (normative)",
              items: [
                { text: "概要", link: "/ja/spec/" },
                { text: "言語コア", link: "/ja/spec/language" },
                { text: "標準ライブラリ", link: "/ja/spec/stdlib" },
                { text: "ルーティング", link: "/ja/spec/routing" },
                { text: "スタイル", link: "/ja/spec/style" },
                { text: "フォーム", link: "/ja/spec/forms" },
                { text: "HTTP / Storage", link: "/ja/spec/http" },
                { text: "ライフサイクル", link: "/ja/spec/lifecycle" },
                { text: "ランタイム", link: "/ja/spec/runtime" },
                { text: "AI 編集", link: "/ja/spec/ai-edit" },
                { text: "テスト", link: "/ja/spec/testing" },
                { text: "エラーコード", link: "/ja/spec/errors" },
              ],
            },
          ],
          "/ja/examples/": [
            {
              text: "例",
              items: [
                { text: "概要", link: "/ja/examples/" },
                { text: "機能別カタログ", link: "/ja/examples/features/" },
              ],
            },
          ],
          "/ja/design-notes/": [{ text: "設計ノート", link: "/ja/design-notes/" }],
        },
      },
    },
  },
});
