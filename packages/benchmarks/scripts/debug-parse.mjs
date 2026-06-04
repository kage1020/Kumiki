import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { lex } from "../src/compiler/lexer.ts";
import { parse } from "../src/compiler/parser.ts";

const src = readFileSync(resolve(process.argv[2]), "utf8");
const program = parse(lex(src));

const reducer = program.defs.find((d) => d.kind === "ReducerDef" && d.name === "clearDone");
console.log(JSON.stringify(reducer, null, 2));
