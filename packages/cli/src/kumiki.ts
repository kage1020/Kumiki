#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { check, compile } from "@kumikijs/compiler";
import { CapabilityManifestError, resolveCapabilities } from "@kumikijs/compiler/node";
import { fixCmd, fixFromTest } from "./fix.ts";
import { addDef, removeDef, renameDef, replaceDef } from "./mutate.ts";
import { runCmd, smokeCmd, testCmd } from "./smoke.ts";
import { findReferences, listDefs, load, viewDef, viewWithDeps } from "./store.ts";

const require = createRequire(import.meta.url);

function usage(): never {
  console.error("Usage:");
  console.error("  kumiki build <input.kumiki> <outdir>");
  console.error("  kumiki list <input.kumiki> [layer]");
  console.error("  kumiki view <input.kumiki> <qname> [--with-deps]");
  console.error("  kumiki refs <input.kumiki> <qname>");
  console.error("  kumiki check <input.kumiki> [--strict-a11y]");
  console.error("  kumiki smoke <input.kumiki>");
  console.error("  kumiki run <input.kumiki> <scenario.json>");
  console.error("  kumiki test <input.kumiki> [name|prefix*]");
  console.error("  kumiki fix <input.kumiki> [--apply] [<code>]");
  console.error("  kumiki fix <input.kumiki> --auto-patch <test-name> [--apply]");
  process.exit(2);
}

/** Resolve manifest capabilities, exiting cleanly on a malformed manifest. */
function capsFor(inputPath: string): string[] {
  try {
    return resolveCapabilities(inputPath);
  } catch (e) {
    if (e instanceof CapabilityManifestError) {
      console.error(`capability manifest error: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}

function buildCmd(inputArg: string, outdirArg: string): void {
  const inputPath = resolve(process.cwd(), inputArg);
  const outdir = resolve(process.cwd(), outdirArg);
  const source = readFileSync(inputPath, "utf8");
  const result = compile(source, {
    runtimeSpecifier: "./runtime.js",
    capabilities: capsFor(inputPath),
  });
  if (result.kind === "fail") {
    for (const err of result.errors) {
      console.error(`${err.code} ${err.kind} at ${err.pos.line}:${err.pos.col}: ${err.message}`);
    }
    process.exit(1);
  }
  mkdirSync(outdir, { recursive: true });
  writeFileSync(resolve(outdir, "app.js"), result.js);
  writeFileSync(resolve(outdir, "runtime.js"), buildRuntimeBundle());
  writeFileSync(resolve(outdir, "index.html"), buildHtml());
  console.log(`Wrote ${outdir}/index.html, app.js, runtime.js`);
}

function listCmd(inputArg: string, layer?: string): void {
  const store = load(resolve(process.cwd(), inputArg));
  const entries = listDefs(store, layer);
  for (const e of entries) {
    console.log(`${e.layer.padEnd(8)} ${e.name}  (${e.range.startLine}-${e.range.endLine})`);
  }
}

function viewCmd(inputArg: string, qname: string, withDeps: boolean): void {
  const store = load(resolve(process.cwd(), inputArg));
  const out = withDeps ? viewWithDeps(store, qname) : viewDef(store, qname);
  if (out === null) {
    console.error(`Definition "${qname}" not found`);
    process.exit(1);
  }
  console.log(out);
}

function refsCmd(inputArg: string, qname: string): void {
  const store = load(resolve(process.cwd(), inputArg));
  const refs = findReferences(store, qname);
  if (refs.length === 0) {
    console.log(`(no references to ${qname})`);
    return;
  }
  for (const r of refs) console.log(`${r.qname}  ${inputArg}:${r.line}`);
}

function checkCmd(inputArg: string, strictA11y: boolean): void {
  const inputPath = resolve(process.cwd(), inputArg);
  const store = load(inputPath);
  const errors = check(store.program, { strictA11y, capabilities: capsFor(inputPath) });
  if (errors.length === 0) {
    console.log("ok");
    return;
  }
  for (const err of errors) {
    console.error(`${err.code} ${err.kind} at ${err.pos.line}:${err.pos.col}: ${err.message}`);
  }
  process.exit(1);
}

async function main(argv: string[]): Promise<void> {
  const cmd = argv[2];
  if (!cmd) usage();
  switch (cmd) {
    case "build": {
      const input = argv[3];
      const out = argv[4];
      if (!input || !out) usage();
      buildCmd(input, out);
      return;
    }
    case "list": {
      const input = argv[3];
      if (!input) usage();
      listCmd(input, argv[4]);
      return;
    }
    case "view": {
      const input = argv[3];
      const qname = argv[4];
      if (!input || !qname) usage();
      const withDeps = argv.includes("--with-deps");
      viewCmd(input, qname, withDeps);
      return;
    }
    case "refs": {
      const input = argv[3];
      const qname = argv[4];
      if (!input || !qname) usage();
      refsCmd(input, qname);
      return;
    }
    case "check": {
      const input = argv[3];
      if (!input) usage();
      const strictA11y = argv.includes("--strict-a11y");
      checkCmd(input, strictA11y);
      return;
    }
    case "smoke": {
      const input = argv[3];
      if (!input) usage();
      const inputPath = resolve(process.cwd(), input);
      await smokeCmd(inputPath, capsFor(inputPath));
      return;
    }
    case "test": {
      const input = argv[3];
      if (!input) usage();
      const inputPath = resolve(process.cwd(), input);
      const filter = argv.find((a, i) => i > 3 && !a.startsWith("--"));
      await testCmd(inputPath, filter, capsFor(inputPath), {
        coverage: argv.includes("--coverage"),
        watch: argv.includes("--watch"),
      });
      return;
    }
    case "run": {
      const input = argv[3];
      const scenario = argv[4];
      if (!input || !scenario) usage();
      const inputPath = resolve(process.cwd(), input);
      await runCmd(inputPath, resolve(process.cwd(), scenario), capsFor(inputPath));
      return;
    }
    case "add": {
      // kumiki add <file> <layer> <name> <body>
      const [, , , file, layer, name, ...rest] = argv;
      if (!file || !layer || !name || rest.length === 0) {
        console.error("Usage: kumiki add <file> <layer> <name> <body>");
        process.exit(2);
      }
      const body = rest.join(" ");
      try {
        addDef(resolve(process.cwd(), file), layer, name, body);
        console.log(`added ${layer}.${name}`);
      } catch (e) {
        console.error(String(e));
        process.exit(1);
      }
      return;
    }
    case "replace": {
      // kumiki replace <file> <qname> <body>
      const [, , , file, qname, ...rest] = argv;
      if (!file || !qname || rest.length === 0) {
        console.error("Usage: kumiki replace <file> <qname> <body>");
        process.exit(2);
      }
      const body = rest.join(" ");
      try {
        replaceDef(resolve(process.cwd(), file), qname, body);
        console.log(`replaced ${qname}`);
      } catch (e) {
        console.error(String(e));
        process.exit(1);
      }
      return;
    }
    case "remove": {
      const [, , , file, qname] = argv;
      if (!file || !qname) {
        console.error("Usage: kumiki remove <file> <qname> [--cascade]");
        process.exit(2);
      }
      try {
        removeDef(resolve(process.cwd(), file), qname, argv.includes("--cascade"));
        console.log(`removed ${qname}`);
      } catch (e) {
        console.error(String(e));
        process.exit(1);
      }
      return;
    }
    case "rename": {
      const [, , , file, qname, newName] = argv;
      if (!file || !qname || !newName) {
        console.error("Usage: kumiki rename <file> <qname> <new-name>");
        process.exit(2);
      }
      try {
        renameDef(resolve(process.cwd(), file), qname, newName);
        console.log(`renamed ${qname} -> ${newName}`);
      } catch (e) {
        console.error(String(e));
        process.exit(1);
      }
      return;
    }
    case "fix": {
      const file = argv[3];
      if (!file) {
        console.error("Usage: kumiki fix <file> [--apply] [<code>]");
        console.error("       kumiki fix <file> --auto-patch <test-name> [--apply]");
        process.exit(2);
      }
      const apply = argv.includes("--apply");
      const autoIdx = argv.indexOf("--auto-patch");
      if (autoIdx !== -1) {
        const testName = argv[autoIdx + 1];
        if (!testName || testName.startsWith("--")) {
          console.error("Usage: kumiki fix <file> --auto-patch <test-name> [--apply]");
          process.exit(2);
        }
        const fixPath = resolve(process.cwd(), file);
        const outcome = await fixFromTest(fixPath, testName, apply, capsFor(fixPath));
        if (!outcome.ok) process.exitCode = 1;
        return;
      }
      const code = argv.find((a, i) => i > 3 && a !== "--apply");
      const plainPath = resolve(process.cwd(), file);
      fixCmd(plainPath, apply, code, capsFor(plainPath));
      return;
    }
    default:
      usage();
  }
}

function buildRuntimeBundle(): string {
  // The prebuilt minified runtime bundle is a browser-ready ESM module that
  // already exports mount / _stdlib / builtinEffects. (The unminified ./bundle
  // variant exists for the inlining path used by smoke/run/test.)
  const runtimeBundlePath = require.resolve("@kumikijs/runtime/bundle.min");
  return readFileSync(runtimeBundlePath, "utf8");
}

function buildHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Kumiki App</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 24px; background: #fafafa; color: #1a1a1a; }
    button { padding: 6px 12px; font-size: 16px; cursor: pointer; }
    h1 { margin: 0 0 12px; }
  </style>
</head>
<body>
  <base href="/">
  <div id="root"></div>
  <script type="module" src="/app.js"></script>
</body>
</html>
`;
}

main(process.argv).catch((e) => {
  console.error(String(e));
  process.exit(1);
});
