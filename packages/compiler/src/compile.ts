import type { Program } from "./ast.ts";
import { type CodegenOptions, codegen, RUNTIME_HELPERS } from "./codegen.ts";
import { lex } from "./lexer.ts";
import { parse } from "./parser.ts";
import { check, type KumikiError } from "./typecheck.ts";

export type CompileOk = { kind: "ok"; js: string; program: Program };
export type CompileFail = { kind: "fail"; errors: KumikiError[] };
export type CompileResult = CompileOk | CompileFail;

export type ExtendedCodegenOptions = CodegenOptions & {
  /** Inline the runtime source into the output so the generated module needs no external import. */
  bundle?: boolean;
  /**
   * Returns the prebuilt runtime bundle JS. Required when `bundle` is true.
   * This is injected (rather than read here) to keep the compiler free of any
   * Node-only imports, so it can run unchanged in the browser. Node callers can
   * use `nodeRuntimeBundleReader` from `@kumiki/compiler/node`.
   */
  readRuntimeBundle?: () => string;
};

/** Inline a runtime bundle into generated module code, stripping the bridging import/export lines. */
export function inlineRuntime(generatedJs: string, runtimeBundleJs: string): string {
  // Drop the runtime's final `export { ... }` line.
  const sanitized = runtimeBundleJs.replace(/^export \{[^}]*\};?\s*$/m, "");
  // Drop the generated code's `import { mount, ... } from "..."` line.
  const withoutImport = generatedJs.replace(/^import \{[^}]*\} from "[^"]*";\s*$/m, "");
  return `${sanitized}\n${withoutImport}`;
}

export function compile(source: string, opts: ExtendedCodegenOptions): CompileResult {
  const tokens = lex(source);
  const program = parse(tokens);
  const errors = check(program);
  if (errors.length > 0) return { kind: "fail", errors };

  const generated = codegen(program, opts);
  let js = `${RUNTIME_HELPERS}\n${generated}`;

  if (opts.bundle) {
    if (!opts.readRuntimeBundle) {
      throw new Error(
        "compile({ bundle: true }) requires a readRuntimeBundle function (see @kumiki/compiler/node).",
      );
    }
    js = inlineRuntime(js, opts.readRuntimeBundle());
  }

  return { kind: "ok", js, program };
}
