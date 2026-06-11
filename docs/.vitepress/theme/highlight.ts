// Client-side Kumiki highlighting for the playground editor. Reuses the
// repo's single source of truth for syntax colors — the @kumikijs/syntax
// TextMate grammar that VitePress already uses for markdown code blocks —
// through a fine-grained Shiki core bundle (JS regex engine, no wasm, only
// the two GitHub themes VitePress defaults to).

import { kumikiGrammar } from "@kumikijs/syntax";
import { createHighlighterCore, type LanguageRegistration } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import githubDark from "shiki/themes/github-dark.mjs";
import githubLight from "shiki/themes/github-light.mjs";

export type Highlight = (code: string) => string;

export async function createKumikiHighlighter(): Promise<Highlight> {
  const highlighter = await createHighlighterCore({
    themes: [githubLight, githubDark],
    // TextMateGrammar keeps `patterns` as unknown[] to stay dependency-free;
    // structurally it IS a Shiki LanguageRegistration.
    langs: [kumikiGrammar as unknown as LanguageRegistration],
    engine: createJavaScriptRegexEngine(),
  });
  return (code) =>
    highlighter.codeToHtml(code, {
      lang: "kumiki",
      themes: { light: "github-light", dark: "github-dark" },
      // Emit --shiki-light/--shiki-dark variables only; the component's CSS
      // picks one based on VitePress's `.dark` class.
      defaultColor: false,
    });
}

// The highlight backdrop must occupy exactly the same height as the textarea
// over it. A source ending in "\n" shows an empty final line in the textarea,
// but Shiki would collapse it — pad it with a space so the line survives.
export function overlayPad(code: string): string {
  return code.endsWith("\n") ? `${code} ` : code;
}
