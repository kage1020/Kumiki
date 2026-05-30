import { defineConfig } from "vitepress";

// Docs are synced into this project root by scripts/sync-docs.mjs (run before
// dev/build). The single source of truth stays at the repo root (../spec, ...).
export default defineConfig({
  title: "Strand",
  description: "AI が書き・直し・並列に触ることを最優先に設計した宣言的 Web アプリ言語",
  lang: "ja",
  cleanUrls: true,
  ignoreDeadLinks: true,
  markdown: {
    // Strand has no Shiki grammar; reuse a close-enough one for color.
    languageAlias: { strand: "rust" },
  },
  themeConfig: {
    nav: [
      { text: "ガイド", link: "/guide/getting-started" },
      { text: "仕様", link: "/spec/" },
      { text: "例", link: "/examples/" },
      { text: "Playground", link: "/guide/playground" },
      { text: "設計ノート", link: "/design-notes/" },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "ガイド",
          items: [
            { text: "はじめに", link: "/guide/getting-started" },
            { text: "最初のアプリ", link: "/guide/your-first-app" },
            { text: "Strand の考え方", link: "/guide/thinking-in-strand" },
            { text: "レシピ", link: "/guide/recipes" },
            { text: "Playground", link: "/guide/playground" },
          ],
        },
      ],
      "/spec/": [
        {
          text: "仕様 (normative)",
          items: [
            { text: "概要", link: "/spec/" },
            { text: "言語コア", link: "/spec/language" },
            { text: "標準ライブラリ", link: "/spec/stdlib" },
            { text: "ルーティング", link: "/spec/routing" },
            { text: "スタイル", link: "/spec/style" },
            { text: "フォーム", link: "/spec/forms" },
            { text: "HTTP / Storage", link: "/spec/http" },
            { text: "ライフサイクル", link: "/spec/lifecycle" },
            { text: "ランタイム", link: "/spec/runtime" },
            { text: "AI 編集", link: "/spec/ai-edit" },
            { text: "テスト", link: "/spec/testing" },
            { text: "エラーコード", link: "/spec/errors" },
          ],
        },
      ],
      "/examples/": [
        {
          text: "例",
          items: [
            { text: "概要", link: "/examples/" },
            { text: "機能別カタログ", link: "/examples/features/" },
          ],
        },
      ],
      "/design-notes/": [{ text: "設計ノート", link: "/design-notes/" }],
    },
    socialLinks: [{ icon: "github", link: "https://github.com/kage1020/strand" }],
    search: { provider: "local" },
  },
});
