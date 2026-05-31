import { defineConfig } from "vitepress";

// Docs are synced into this project root by scripts/sync-docs.mjs (run before
// dev/build). The single source of truth stays at the repo root (../spec, ...).
export default defineConfig({
  title: "Strand",
  description:
    "A declarative web app language designed first and foremost for AI to write, edit, and touch in parallel",
  lang: "en",
  cleanUrls: true,
  ignoreDeadLinks: true,
  markdown: {
    // Strand has no Shiki grammar; reuse a close-enough one for color.
    languageAlias: { strand: "rust" },
  },
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
            { text: "Thinking in Strand", link: "/guide/thinking-in-strand" },
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
    socialLinks: [{ icon: "github", link: "https://github.com/kage1020/strand" }],
    search: { provider: "local" },
  },
});
