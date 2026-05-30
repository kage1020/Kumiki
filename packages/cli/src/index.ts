// Public API of @strand/cli — the programmatic surface behind the `strand` command.

export { type AutoPatch, fixCmd, planFixes } from "./fix.ts";
export { addDef, removeDef, renameDef, replaceDef } from "./mutate.ts";
export { runCmd, runScenarioSource, smokeCmd, smokeFile, smokeSource } from "./smoke.ts";
export {
  directDeps,
  findReferences,
  listDefs,
  load,
  type Store,
  viewDef,
  viewWithDeps,
} from "./store.ts";
