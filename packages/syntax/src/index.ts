import grammarJson from "../kumiki.tmLanguage.json";

/**
 * A TextMate grammar object. Structurally compatible with Shiki's
 * `LanguageRegistration` and VS Code's `IGrammar`, but declared here so this
 * package stays dependency-free (consumers cast to their own grammar type).
 */
export interface TextMateGrammar {
  name: string;
  scopeName: string;
  displayName?: string;
  fileTypes?: string[];
  patterns: unknown[];
  repository?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * The Kumiki TextMate grammar, ready to register with Shiki
 * (`markdown.languages`), VitePress, or any TextMate-compatible highlighter.
 *
 * The raw `.json` is also published and reachable at
 * `@kumikijs/syntax/grammar.json` for tools that want a file path
 * (e.g. a VS Code extension's `contributes.grammars`).
 */
export const kumikiGrammar: TextMateGrammar = grammarJson;

export default kumikiGrammar;
