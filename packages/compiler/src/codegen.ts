// Phase 2 codegen: AST → self-contained ES module that uses the runtime API.

import type {
  AppDef,
  EffectDef,
  Expr,
  FnDef,
  Lvalue,
  Pattern,
  PolicyExpr,
  Program,
  ReducerDef,
  Refinement,
  SlotDef,
  Statement,
  TestDef,
  TileDef,
  TileExpr,
  TypeDef,
  TypeExpr,
} from "./ast.ts";

export type CodegenOptions = {
  runtimeSpecifier: string;
  /** Emit the in-language `test` definitions (`__kumikiTests`). Off for production builds. */
  includeTests?: boolean;
  /**
   * Emit `export default App;` instead of auto-mounting to `#root`. Use when the
   * module is imported (e.g. the Vite plugin / Web Component embedding) rather
   * than run as a standalone page bundle.
   */
  exportApp?: boolean;
};

export function codegen(program: Program, opts: CodegenOptions): string {
  const types = new Map(
    program.defs.filter((d): d is TypeDef => d.kind === "TypeDef").map((d) => [d.name, d]),
  );
  const slots = program.defs.filter((d): d is SlotDef => d.kind === "SlotDef");
  const effects = program.defs.filter((d): d is EffectDef => d.kind === "EffectDef");
  const reducers = program.defs.filter((d): d is ReducerDef => d.kind === "ReducerDef");
  const fns = program.defs.filter((d): d is FnDef => d.kind === "FnDef");
  const tiles = program.defs.filter((d): d is TileDef => d.kind === "TileDef");
  const apps = program.defs.filter((d): d is AppDef => d.kind === "AppDef");
  const themes = program.defs.filter(
    (d): d is import("./ast.ts").ThemeDef => d.kind === "ThemeDef",
  );
  const motions = program.defs.filter(
    (d): d is import("./ast.ts").MotionDef => d.kind === "MotionDef",
  );
  const tests = program.defs.filter((d): d is TestDef => d.kind === "TestDef");
  const app = apps[0];
  if (!app) throw new Error("No app definition found");

  const ctx: GenCtx = { slots, fns, tiles, reducers, effects, types };

  const lines: string[] = [];
  lines.push(`import { mount, _stdlib, builtinEffects } from "${opts.runtimeSpecifier}";`);
  lines.push("");
  lines.push("const _s = _stdlib;");
  lines.push("");

  // Everything that closes over slot state lives inside `createApp()` so each
  // call produces an independent instance (its own `live` + closures). Multiple
  // mounts / Web Component instances therefore never share state. Pure module
  // data (`_s`) stays outside.
  lines.push("function createApp() {");

  // fn definitions
  for (const fn of fns) {
    lines.push(genFn(fn, ctx));
  }

  // effect handlers (per capability, statically dispatched)
  lines.push("const _effects = {");
  for (const eff of effects) {
    lines.push(`  ${JSON.stringify(eff.name)}: ${genEffect(eff, ctx)},`);
  }
  lines.push("};");
  lines.push("");

  // Slots
  lines.push("const _slots = {");
  for (const s of slots) {
    const refine = refinementJs(s.type, ctx);
    const init = jsOfExpr(s.init, makeEvalCtx(ctx, new Set()));
    lines.push(
      `  ${JSON.stringify(s.name)}: { value: ${init}${refine ? `, refine: ${refine}` : ""} },`,
    );
  }
  lines.push("};");
  lines.push("");

  // Live slot values
  lines.push("const _live = {};");
  lines.push("for (const [k, v] of Object.entries(_slots)) _live[k] = v.value;");
  lines.push("");

  // Reducers
  lines.push("const _reducers = [");
  for (const r of reducers) lines.push(genReducer(r, ctx));
  lines.push("];");
  lines.push("");

  // Routes table — each route entry produces either a tile factory or a redirect.
  lines.push("const _routes = [");
  for (const r of app.routes) {
    if (r.tile.startsWith(">>")) {
      const target = r.tile.slice(2);
      lines.push(
        `  { pattern: ${JSON.stringify(r.path)}, redirectTo: ${JSON.stringify(target)} },`,
      );
    } else {
      const tile = tiles.find((t) => t.name === r.tile);
      if (!tile) throw new Error(`Route ${r.path} targets undefined tile "${r.tile}"`);
      lines.push(`  { pattern: ${JSON.stringify(r.path)}, tile: () => ${genTile(tile, ctx)} },`);
    }
  }
  lines.push("];");
  lines.push("");

  // Theme registry — the app's chosen theme is selected at mount time.
  lines.push("const _themes = {");
  for (const t of themes) {
    lines.push(`  ${JSON.stringify(t.name)}: ${JSON.stringify(t.body)},`);
  }
  lines.push("};");
  const themeRef = app.theme ? JSON.stringify(app.theme) : "null";
  lines.push("");

  // Motion registry — reusable, scoped animations (M5). The runtime turns each
  // into a `@keyframes` + class block at mount. See ADR-001.
  lines.push("const _motions = {");
  for (const m of motions) {
    lines.push(`  ${JSON.stringify(m.name)}: ${JSON.stringify(m.body)},`);
  }
  lines.push("};");
  lines.push("");

  // App object for this instance (its closures above bind to this call's `_live`).
  lines.push("const App = {");
  lines.push("  slots: _slots,");
  lines.push(`  caps: ${JSON.stringify(app.caps)},`);
  lines.push("  reducers: _reducers,");
  lines.push("  effects: _effects,");
  lines.push(`  init: [${app.init.map((e) => emitFromInitExpr(e)).join(", ")}],`);
  lines.push("  routes: _routes,");
  lines.push("  live: _live,");
  lines.push("  themes: _themes,");
  lines.push(`  themeName: ${themeRef},`);
  lines.push("  motions: _motions,");
  lines.push("};");

  // In-language test tile factories close over this instance's live state, so
  // they are built inside the factory and attached to the app.
  if (opts.includeTests && tests.length > 0) {
    lines.push("const _tilesById = {");
    for (const tile of tiles) {
      lines.push(`  ${JSON.stringify(tile.name)}: (${jsName("$1")}) => ${genTile(tile, ctx)},`);
    }
    lines.push("};");
    lines.push("App._tilesById = _tilesById;");
  }

  lines.push("  return App;");
  lines.push("}"); // end createApp
  lines.push("");
  // The default instance — used by auto-mount, the embedding host, and tooling.
  lines.push("const App = createApp();");
  lines.push("globalThis.__kumikiApp = App;");

  // In-language tests (`kumiki test`) run against the default instance.
  if (opts.includeTests && tests.length > 0) {
    lines.push("");
    lines.push("const __kumikiTests = [");
    for (const t of tests) lines.push(genTest(t, ctx));
    lines.push("];");
    lines.push("globalThis.__kumikiTests = __kumikiTests;");
  }
  lines.push("");

  if (opts.exportApp) {
    // Module mode: the importer (Vite plugin / embedding host) owns mounting.
    // `createApp` lets a host spin up multiple independent instances.
    lines.push("export default App;");
    lines.push("export { createApp };");
  } else {
    // Auto-mount. A host embedding the bundle can register custom-capability
    // providers by assigning `globalThis.__kumikiProviders`, and pass any other
    // MountOptions (e.g. `{ router: "memory" }` for a sandboxed preview that
    // doesn't own the URL, #36) via `globalThis.__kumikiMount`, before this
    // module loads (the inbound ecosystem seam; see runtime CapabilityProvider).
    lines.push(
      `mount(App, document.getElementById("root"), { providers: globalThis.__kumikiProviders, ...globalThis.__kumikiMount });`,
    );
  }

  return lines.join("\n");
}

// ----- test layer -----

function recordField(e: Expr | TileExpr, name: string): Expr | undefined {
  if ((e as Expr).kind !== "RecordLit") return undefined;
  return (e as Expr & { kind: "RecordLit" }).fields.find((f) => f.name === name)?.value;
}

function genTest(t: TestDef, gen: GenCtx): string {
  const ctx = makeEvalCtx(gen, new Set());
  const nameJs = JSON.stringify(t.name);
  if (t.testKind === "reducer-test") {
    const slots = recordField(t.given, "slots");
    const event = recordField(t.given, "event");
    const slotsJs = slots ? jsOfExpr(slots, ctx) : "({})";
    const elJs = eventPayloadJs(event, ctx);
    const panic = recordField(t.expect, "panic");
    let expectJs: string;
    if (panic) {
      expectJs = `{ kind: "panic", message: ${jsOfExpr(panic, ctx)} }`;
    } else {
      const xs = recordField(t.expect, "slots");
      const xe = recordField(t.expect, "effects");
      const xsJs = xs ? jsOfExpr(xs, ctx) : "({})";
      const effectsJs = xe ? effectListJs(xe, ctx) : "[]";
      expectJs = `{ kind: "state", slots: ${xsJs}, effects: ${effectsJs} }`;
    }
    return `  {
    name: ${nameJs},
    kind: "reducer-test",
    run: () => {
      _s.resetLive(App.live, App.slots, ${slotsJs});
      const _el = ${elJs};
      const _r = App.reducers.find((r) => r.name === ${JSON.stringify(t.target)});
      if (!_r) throw new Error("reducer ${t.target} not found");
      let _res = null, _panic = null;
      try { _res = _r.apply(App.live, { $el: _el, $event: _el }); }
      catch (e) { _panic = (e && e.message) ? e.message : String(e); }
      return _s.runReducerTest({ name: ${nameJs}, givenSlots: { ...App.live }, result: _res, panic: _panic, expect: ${expectJs} });
    },
  },`;
  }
  // tile-test
  const slots = recordField(t.given, "slots");
  const slotsJs = slots ? jsOfExpr(slots, ctx) : "({})";
  const inField = recordField(t.given, "in");
  const inJs = inField ? jsOfExpr(inField, ctx) : "undefined";
  const expectedJs = tileExprJs(t.expect as TileExpr, gen, ctx);
  return `  {
    name: ${nameJs},
    kind: "tile-test",
    run: () => {
      _s.resetLive(App.live, App.slots, ${slotsJs});
      const _actual = App._tilesById[${JSON.stringify(t.target)}](${inJs});
      const _expected = ${expectedJs};
      return _s.runTileTest({ name: ${nameJs}, actual: _actual, expected: _expected });
    },
  },`;
}

/**
 * Compile a `[eff(a), ...]` expect.effects list into `[{effect, args, argsSpecified}]`.
 * A bare name (`persist`) matches by name only (`argsSpecified: false`); a call
 * (`persist(x)`, even `persist()`) pins the exact arguments (`argsSpecified: true`).
 */
function effectListJs(e: Expr, ctx: EvalCtx): string {
  if (e.kind !== "ListLit") return "[]";
  const items = e.items.map((it) => {
    if (it.kind === "Call") {
      const args = it.args.map((a) => jsOfExpr(a, ctx)).join(", ");
      return `{ effect: ${JSON.stringify(it.callee)}, args: [${args}], argsSpecified: true }`;
    }
    if (it.kind === "Ref") {
      return `{ effect: ${JSON.stringify(it.name)}, args: [], argsSpecified: false }`;
    }
    return `{ effect: "?", args: [], argsSpecified: false }`;
  });
  return `[${items.join(", ")}]`;
}

/**
 * The reducer payload (`$el` / `$event`) for a reducer-test's `given.event`.
 * Uses `el` when present (spec §8.5), otherwise the event's other fields
 * (everything except `type` / `target`) so flat `{type, target, value}` forms
 * still reach the reducer.
 */
function eventPayloadJs(event: Expr | undefined, ctx: EvalCtx): string {
  if (event?.kind !== "RecordLit") return "({})";
  const el = event.fields.find((f) => f.name === "el");
  if (el) return jsOfExpr(el.value, ctx);
  const rest = event.fields.filter((f) => f.name !== "type" && f.name !== "target");
  if (rest.length === 0) return "({})";
  return jsOfExpr({ kind: "RecordLit", fields: rest, pos: event.pos }, ctx);
}

type GenCtx = {
  slots: SlotDef[];
  fns: FnDef[];
  tiles: TileDef[];
  reducers: ReducerDef[];
  effects: EffectDef[];
  types: Map<string, TypeDef>;
};

type EvalCtx = {
  gen: GenCtx;
  localBinds: Set<string>;
  /** When set, Ref(slot) reads from `_next` first, falling back to `_live`. */
  reducerScope?: boolean;
};

function makeEvalCtx(gen: GenCtx, locals: Set<string>, reducerScope = false): EvalCtx {
  return { gen, localBinds: new Set(locals), reducerScope };
}

function _findTile(tiles: TileDef[], name: string): TileDef {
  const t = tiles.find((x) => x.name === name);
  if (!t) throw new Error(`Tile "${name}" not found`);
  return t;
}

// ----- fn -----

function genFn(fn: FnDef, gen: GenCtx): string {
  const params = fn.params.map((p) => p.name).join(", ");
  const ctx = makeEvalCtx(gen, new Set([...fn.params.map((p) => p.name), "$1", "$2"]));
  return `function ${jsName(fn.name)}(${params}) { return ${jsOfExpr(fn.body, ctx)}; }`;
}

// ----- effect -----

/**
 * The built-in implementation call for a standard capability, given the request
 * variable name. Returns null for custom capabilities (no built-in — a host
 * provider is required).
 */
function builtinEffectCall(eff: EffectDef, reqVar: string): string | null {
  if (eff.cap === "storage.read") {
    return `builtinEffects.storageRead(${eff.mapRequest ? `{ key: ${reqVar}.key }` : reqVar})`;
  }
  if (eff.cap === "storage.write") {
    return `builtinEffects.storageWrite(${
      eff.mapRequest ? `{ key: ${reqVar}.key, value: ${reqVar}.value }` : reqVar
    })`;
  }
  if (eff.cap.startsWith("http.")) {
    const method = eff.cap.slice("http.".length).toUpperCase();
    return `builtinEffects.httpFetch(${JSON.stringify(method)}, ${reqVar}, "")`;
  }
  return null;
}

function genEffect(eff: EffectDef, gen: GenCtx): string {
  // Every effect invoke follows one shape: (1) map the request if `map-request`
  // is present, (2) consult the host provider for this capability and delegate
  // to it if registered (the ecosystem seam — lets a host swap the HTTP
  // transport, inject auth, mock, etc.), (3) otherwise fall back to the built-in
  // implementation. Custom capabilities have no built-in, so their fallback is a
  // clear "no provider" error.
  const capJs = JSON.stringify(eff.cap);
  const reqVar = eff.mapRequest ? "req" : "input";
  const builtin = builtinEffectCall(eff, reqVar);
  const fallback =
    builtin ??
    `{ kind: "err", value: { message: ${JSON.stringify(`Capability ${eff.cap} has no provider`)} } }`;
  const tail = `const p = caps.provider(${capJs}); if (p) return p(${reqVar}, caps); return ${fallback};`;

  let invokeBody: string;
  if (eff.mapRequest) {
    const mapJs = jsOfExpr(eff.mapRequest, makeEvalCtx(gen, new Set(["$1"])));
    invokeBody = `async (${jsName("$1")}, caps) => { const req = ${mapJs}; ${tail} }`;
  } else {
    invokeBody = `async (input, caps) => { ${tail} }`;
  }

  return `{
    name: ${JSON.stringify(eff.name)},
    cap: ${JSON.stringify(eff.cap)},
    policy: ${policyJs(eff.policy)},
    invoke: ${invokeBody},
  }`;
}

function policyJs(p?: PolicyExpr): string {
  if (!p) return "undefined";
  switch (p.kind) {
    case "PolLatest":
      return `{ kind: "latest" }`;
    case "PolLatestKey":
      return `{ kind: "latest-per-key", keyOf: ((${jsName("$1")}) => String(${jsOfExpr(p.key, { gen: {} as GenCtx, localBinds: new Set(["$1"]) })})) }`;
    case "PolQueue":
      return `{ kind: "queue" }`;
    case "PolDebounce":
      return `{ kind: "debounce", ms: ${p.ms} }`;
    case "PolThrottle":
      return `{ kind: "throttle", ms: ${p.ms} }`;
    case "PolOnce":
      return `{ kind: "once" }`;
  }
}

// ----- reducer -----

function genReducer(r: ReducerDef, gen: GenCtx): string {
  const locals = new Set<string>(["$el", "$event", "$route"]);
  if (r.on.kind === "EffectEvent") for (const b of r.on.binds) if (b !== "_") locals.add(b);
  const ctx = makeEvalCtx(gen, locals, true);

  // event descriptor
  let eventJs: string;
  let selectorJs = "undefined";
  if (r.on.kind === "UiEvent") {
    eventJs = `{ kind: "ui", ev: ${JSON.stringify(r.on.ev)} }`;
    selectorJs = `{ tile: ${JSON.stringify(r.on.selector.tile)}${r.on.selector.id ? `, id: ${JSON.stringify(r.on.selector.id)}` : ""} }`;
  } else if (r.on.kind === "EffectEvent") {
    eventJs = `{ kind: "effect", effect: ${JSON.stringify(r.on.effect)}, outcome: ${JSON.stringify(r.on.outcome)} }`;
  } else if (r.on.kind === "TimerEvent") {
    const nameJs = r.on.name !== undefined ? `, name: ${JSON.stringify(r.on.name)}` : "";
    eventJs = `{ kind: "timer", intervalMs: ${r.on.intervalMs}${nameJs} }`;
  } else {
    eventJs = `{ kind: "lifecycle", name: ${JSON.stringify(r.on.name)} }`;
  }

  // emits collection
  const stmtLines: string[] = [];
  stmtLines.push(`const _next = {};`);
  stmtLines.push(`const _emits = [];`);
  stmtLines.push(`const _stops = [];`);
  // bind payload positional args. For effect events, $1, $2, etc. are payload props.
  if (r.on.kind === "EffectEvent") {
    for (let i = 0; i < r.on.binds.length; i++) {
      const name = r.on.binds[i]!;
      if (name === "_") continue;
      stmtLines.push(`const ${jsName(name)} = _payload[${JSON.stringify(`$${i + 1}`)}];`);
    }
  }
  stmtLines.push(`const ${jsName("$el")} = _payload.$el || {};`);
  stmtLines.push(`const ${jsName("$event")} = _payload.$event || _payload || {};`);
  stmtLines.push(`const ${jsName("$route")} = _payload.$route || {};`);

  for (const st of r.do) stmtLines.push(genStatement(st, ctx));

  stmtLines.push(`return { slots: _next, emits: _emits, stopTimers: _stops };`);

  return `  {
    name: ${JSON.stringify(r.name)},
    selector: ${selectorJs},
    event: ${eventJs},
    apply: (_slotsLive, _payload) => {
      ${stmtLines.join("\n      ")}
    },
  },`;
}

function genStatement(s: Statement, ctx: EvalCtx): string {
  if (s.kind === "ForStmt") {
    const iter = jsOfExpr(s.iter, ctx);
    const inner = makeEvalCtx(ctx.gen, ctx.localBinds, ctx.reducerScope);
    inner.localBinds.add(s.bind);
    const body = s.body.map((b) => genStatement(b, inner)).join("\n  ");
    return `for (const ${jsName(s.bind)} of ((${iter}) || [])) {\n  ${body}\n}`;
  }
  if (s.kind === "IfStmt") {
    const cond = jsOfExpr(s.cond, ctx);
    const thenBody = s.consequent.map((b) => genStatement(b, ctx)).join("\n  ");
    const elseBody = s.alternate.map((b) => genStatement(b, ctx)).join("\n  ");
    return `if (${cond}) {\n  ${thenBody}\n} else {\n  ${elseBody}\n}`;
  }
  if (s.kind === "MatchStmt") {
    const sc = jsOfExpr(s.scrutinee, ctx);
    const arms = s.arms
      .map((arm) => {
        if (arm.pattern.kind === "PVariant") {
          const inner = makeEvalCtx(ctx.gen, ctx.localBinds, ctx.reducerScope);
          for (const b of arm.pattern.binds) if (b !== "_") inner.localBinds.add(b);
          const binds = arm.pattern.binds
            .map((b, i) =>
              b !== "_" ? `const ${jsName(b)} = _v[${JSON.stringify(`_${i}`)}];` : "",
            )
            .join(" ");
          const body = arm.body.map((b) => genStatement(b, inner)).join("\n  ");
          return `if (_s.variantIs(_v, ${JSON.stringify(arm.pattern.name)})) { ${binds}\n  ${body}\n}`;
        }
        if (arm.pattern.kind === "PBind") {
          const inner = makeEvalCtx(ctx.gen, ctx.localBinds, ctx.reducerScope);
          inner.localBinds.add(arm.pattern.name);
          const body = arm.body.map((b) => genStatement(b, inner)).join("\n  ");
          return `if (true) { const ${jsName(arm.pattern.name)} = _v;\n  ${body}\n}`;
        }
        if (arm.pattern.kind === "PWildcard") {
          const body = arm.body.map((b) => genStatement(b, ctx)).join("\n  ");
          return `if (true) {\n  ${body}\n}`;
        }
        const body = arm.body.map((b) => genStatement(b, ctx)).join("\n  ");
        return `if (_v === ${JSON.stringify(arm.pattern.value)}) {\n  ${body}\n}`;
      })
      .join(" else ");
    return `{ const _v = ${sc};\n  ${arms}\n}`;
  }
  if (s.kind === "NoopStmt") {
    return `/* no-op */`;
  }
  if (s.kind === "LetStmt") {
    const rhs = jsOfExpr(s.rhs, ctx);
    ctx.localBinds.add(s.name);
    return `const ${jsName(s.name)} = ${rhs};`;
  }
  if (s.kind === "Emit") {
    const args = s.args.map((a) => jsOfExpr(a, ctx)).join(", ");
    return `_emits.push({ effect: ${JSON.stringify(s.effect)}, args: [${args}] });`;
  }
  if (s.kind === "StopTimer") {
    return `_stops.push(${JSON.stringify(s.name)});`;
  }
  return genSlotAssign(s.lvalue, s.rhs, ctx);
}

function genSlotAssign(lv: Lvalue, rhs: Expr, ctx: EvalCtx): string {
  const rhsJs = jsOfExpr(rhs, ctx);
  if (lv.kind === "LSlot") {
    return `_next[${JSON.stringify(lv.name)}] = ${rhsJs};`;
  }
  // Build update for nested lvalue.
  // The root slot name + path → produce a new object.
  const root = lvalueRootName(lv);
  const path: ({ kind: "field"; name: string } | { kind: "index"; expr: Expr })[] = [];
  let cur: Lvalue = lv;
  while (cur.kind !== "LSlot") {
    if (cur.kind === "LField") path.unshift({ kind: "field", name: cur.field });
    else path.unshift({ kind: "index", expr: cur.index });
    cur = cur.base;
  }
  // Generate an inline `setPath(root, path, value)` expression. Inside a reducer
  // body we read from `_next` first so successive writes in a `for` loop see
  // the previous iteration's updates.
  const rootKey = JSON.stringify(root);
  const baseJs = ctx.reducerScope
    ? `(((_next[${rootKey}] !== undefined) ? _next[${rootKey}] : _live[${rootKey}]) ?? {})`
    : `(_live[${rootKey}] ?? {})`;
  let pathExpr = "";
  for (const seg of path) {
    if (seg.kind === "field") pathExpr += `, ${JSON.stringify(seg.name)}`;
    else pathExpr += `, ${jsOfExpr(seg.expr, ctx)}`;
  }
  return `_next[${JSON.stringify(root)}] = _setPath(${baseJs}, [${pathExpr.replace(/^, /, "")}], ${rhsJs});`;
}

function lvalueRootName(lv: Lvalue): string {
  while (lv.kind !== "LSlot") lv = lv.base;
  return lv.name;
}

// ----- expressions -----

function jsOfExpr(e: Expr, ctx: EvalCtx): string {
  switch (e.kind) {
    case "Num":
      return String(e.value);
    case "Str":
      return JSON.stringify(e.value);
    case "Bool":
      return e.value ? "true" : "false";
    case "Unit":
      return "null";
    case "Ref": {
      if (ctx.localBinds.has(e.name)) return jsName(e.name);
      if (e.name === "now") return `_s.now()`;
      // `route` is an auto-managed slot maintained by the runtime.
      if (e.name === "route") {
        return ctx.reducerScope
          ? `((_next["route"] !== undefined) ? _next["route"] : _live["route"])`
          : `_live["route"]`;
      }
      const isSlot = ctx.gen.slots?.some((s) => s.name === e.name);
      if (isSlot) {
        const key = JSON.stringify(e.name);
        return ctx.reducerScope
          ? `((_next[${key}] !== undefined) ? _next[${key}] : _live[${key}])`
          : `_live[${key}]`;
      }
      return jsName(e.name);
    }
    case "BinOp": {
      const l = jsOfExpr(e.lhs, ctx);
      const r = jsOfExpr(e.rhs, ctx);
      if (e.op === "+") return `_s.add(${l}, ${r})`;
      if (e.op === "&") return `(${l} && ${r})`;
      if (e.op === "|") return `(${l} || ${r})`;
      if (e.op === "==") return `_s.eq(${l}, ${r})`;
      if (e.op === "!=") return `(!_s.eq(${l}, ${r}))`;
      return `(${l} ${e.op} ${r})`;
    }
    case "UnaryOp":
      return `(${e.op === "!" ? "!" : "-"}${jsOfExpr(e.rhs, ctx)})`;
    case "FieldAccess": {
      const baseJs = jsOfExpr(e.base, ctx);
      // ADR-002 (#23): when the checker has inferred that the receiver is a
      // record with this field, read the field — do NOT let a same-named method
      // shortcut shadow it. `accessKind` is only set when `check()` ran; absent,
      // we keep the historical name-based dispatch below (back-compat).
      if (e.accessKind === "field") return `(${baseJs})[${JSON.stringify(e.field)}]`;
      // For Option/Result values stored as {_tag,_0}, accessing common fields like
      // ".get" needs unwrapping. We special-case ".get" / ".is-some" / ".is-none" /
      // ".is-ok" / ".is-err".
      if (e.field === "get") return `_s.unwrap(${baseJs})`;
      if (e.field === "is-some") return `(_s.variantIs(${baseJs}, "Some"))`;
      if (e.field === "is-none") return `(_s.variantIs(${baseJs}, "None"))`;
      if (e.field === "is-ok") return `(_s.variantIs(${baseJs}, "Ok"))`;
      if (e.field === "is-err") return `(_s.variantIs(${baseJs}, "Err"))`;
      if (e.field === "keys") return `_s.mapKeys(${baseJs})`;
      if (e.field === "values") return `_s.mapValues(${baseJs})`;
      if (e.field === "entries") return `_s.mapEntries(${baseJs})`;
      if (e.field === "size") return `_s.mapSize(${baseJs})`;
      // Time / Duration helpers: in Phase 2 these are stored as raw numbers.
      if (e.field === "to-ms" || e.field === "ms") return `(${baseJs})`;
      // .show on values (variants → _tag, numbers/strings → String)
      if (e.field === "show") return `_s.show(${baseJs})`;
      // .length on text/list/string
      if (e.field === "length") return `((${baseJs}) ?? "").length`;
      if (e.field === "is-empty")
        return `(((${baseJs}) ?? []).length === 0 || ((${baseJs}) ?? "") === "")`;
      // .lower / .upper on Text
      if (e.field === "lower") return `(String((${baseJs}) ?? "")).toLowerCase()`;
      if (e.field === "upper") return `(String((${baseJs}) ?? "")).toUpperCase()`;
      if (e.field === "trim") return `(String((${baseJs}) ?? "")).trim()`;
      // Zero-arg list / string method shorthands (callable without parens)
      if (e.field === "unique") return `[...new Set((${baseJs}) ?? [])]`;
      if (e.field === "reverse") return `[...((${baseJs}) ?? [])].reverse()`;
      if (e.field === "sort") return `[...((${baseJs}) ?? [])].sort()`;
      // Issue #7: argument-less spec stdlib methods in the parenthesis-free form
      // (docs/spec/stdlib.md §2.2.3 — the recommended shortcut). Kept in exact sync
      // with the MethodCall (paren) cases in methodCallJs + KNOWN_METHODS.
      if (e.field === "head") return `_s.listHead(${baseJs})`;
      if (e.field === "tail") return `_s.listTail(${baseJs})`;
      if (e.field === "last") return `_s.listLast(${baseJs})`;
      if (e.field === "to-list") return `_s.toList(${baseJs})`;
      if (e.field === "get-err") return `_s.getErr(${baseJs})`;
      if (e.field === "to-option") return `_s.toOption(${baseJs})`;
      if (e.field === "parse-int") return `_s.parseIntOpt(${baseJs})`;
      if (e.field === "parse-float") return `_s.parseFloatOpt(${baseJs})`;
      if (e.field === "abs") return `Math.abs(${baseJs})`;
      if (e.field === "neg") return `(-(${baseJs}))`;
      if (e.field === "to-float") return `(${baseJs})`;
      if (e.field === "to-int") return `Math.trunc(${baseJs})`;
      return `(${baseJs})[${JSON.stringify(e.field)}]`;
    }
    case "Index": {
      return `(${jsOfExpr(e.base, ctx)})[${jsOfExpr(e.index, ctx)}]`;
    }
    case "Call": {
      const cn = e.callee;
      // Module calls like TodoId.fresh, now, etc.
      if (cn === "now") return `_s.now()`;
      if (/^[A-Z][A-Za-z0-9_]*\.fresh$/.test(cn)) return `_s.freshId()`;
      if (/^[A-Z][A-Za-z0-9_]*\.parse$/.test(cn)) {
        // `T.parse(text)` → Option<T>. Numeric types coerce to a number so
        // arithmetic (e.g. fold/sum) works; other types keep the string.
        const a = e.args[0] ? jsOfExpr(e.args[0], ctx) : '""';
        const qualifier = cn.split(".")[0];
        if (qualifier === "Int") {
          return `((_v) => { const _n = Number(_v); return (String(_v).trim() !== "" && Number.isFinite(_n)) ? _s.Some(Math.trunc(_n)) : _s.None; })(${a})`;
        }
        if (qualifier === "Float") {
          return `((_v) => { const _n = Number(_v); return (String(_v).trim() !== "" && Number.isFinite(_n)) ? _s.Some(_n) : _s.None; })(${a})`;
        }
        return `((_v) => (typeof _v === "string" && _v.length > 0) ? _s.Some(_v) : _s.None)(${a})`;
      }
      if (/^[A-Z][A-Za-z0-9_]*\.show$/.test(cn)) {
        const a = e.args[0] ? jsOfExpr(e.args[0], ctx) : '""';
        return `_s.show(${a})`;
      }
      // Duration constructors → milliseconds (Time is stored as a raw ms number).
      if (cn === "Duration.ms") return `(${e.args[0] ? jsOfExpr(e.args[0], ctx) : "0"})`;
      if (cn === "Duration.s") return `((${e.args[0] ? jsOfExpr(e.args[0], ctx) : "0"}) * 1000)`;
      if (cn === "Duration.m" || cn === "Duration.min")
        return `((${e.args[0] ? jsOfExpr(e.args[0], ctx) : "0"}) * 60000)`;
      if (cn === "Duration.h") return `((${e.args[0] ? jsOfExpr(e.args[0], ctx) : "0"}) * 3600000)`;
      if (cn === "Duration.d" || cn === "Duration.days")
        return `((${e.args[0] ? jsOfExpr(e.args[0], ctx) : "0"}) * 86400000)`;
      // Decoder.* — codegen treats decoders as a sentinel string; the builtin storage handler
      // ignores everything except "json".
      if (cn === "Decoder.Json") return `"json"`;
      if (cn === "Decoder.Text") return `"text"`;
      if (cn === "Decoder.Bytes") return `"bytes"`;
      if (cn === "Decoder.None") return `"none"`;
      if (cn === "fmt") {
        // fmt(template, ...args) — very simple {0} {1} substitution
        const args = e.args.map((a) => jsOfExpr(a, ctx));
        return `_s.fmt ? _s.fmt(${args.join(", ")}) : ${args[0] ?? '""'}`;
      }
      // `panic(message)` — Kumiki's controlled stop-the-program signal
      // (docs/spec/stdlib.md §2.2). Lowers to the runtime helper that throws a
      // KumikiPanic, which the live dispatch / render boundary catches.
      if (cn === "panic") {
        const a = e.args[0] ? jsOfExpr(e.args[0], ctx) : '""';
        return `_s.panic(${a})`;
      }
      const args = e.args.map((a) => jsOfExpr(a, ctx)).join(", ");
      // Otherwise treat as user-defined fn
      return `${jsName(cn)}(${args})`;
    }
    case "MethodCall": {
      return methodCallJs(e.receiver, e.method, e.args, ctx);
    }
    case "RecordLit": {
      const parts = e.fields.map((f) => `${JSON.stringify(f.name)}: ${jsOfExpr(f.value, ctx)}`);
      return `{ ${parts.join(", ")} }`;
    }
    case "ListLit":
      return `[${e.items.map((it) => jsOfExpr(it, ctx)).join(", ")}]`;
    case "MapLit": {
      const parts = e.entries.map((en) => {
        // A `<any-id>` map key (test expect, §8.2.2) lowers to the runtime's
        // wild-key sentinel so the matcher pairs it with the one generated entry.
        const keyJs =
          en.key.kind === "Wildcard" && en.key.wild === "any-id"
            ? "[_s.WILD_KEY]"
            : `[${jsOfExpr(en.key, ctx)}]`;
        return `${keyJs}: ${jsOfExpr(en.value, ctx)}`;
      });
      return `{ ${parts.join(", ")} }`;
    }
    case "Wildcard":
      // Value-position wildcard (`<any-id>` / `<slots.X>`) → a runtime sentinel
      // that `wcEqual` recognises during reducer-test comparison.
      return e.wild === "any-id"
        ? `_s.wild("any-id")`
        : `_s.wild("slot", ${JSON.stringify(e.slot)})`;
    case "MatchExpr":
      return matchExprJs(e, ctx);
    case "IfExpr":
      return `((${jsOfExpr(e.cond, ctx)}) ? (${jsOfExpr(e.consequent, ctx)}) : (${jsOfExpr(e.alternate, ctx)}))`;
    case "LetIn": {
      const inner = makeEvalCtx(ctx.gen, ctx.localBinds);
      inner.localBinds.add(e.name);
      return `(() => { const ${jsName(e.name)} = ${jsOfExpr(e.value, ctx)}; return ${jsOfExpr(e.body, inner)}; })()`;
    }
    case "Variant":
      return variantJs(e.name, e.payload, ctx);
  }
}

/**
 * Methods the code generator actually implements (the `methodCallJs` switch
 * cases below). This is the single source of truth for what `obj.method(...)`
 * calls are runnable; the typechecker uses it to flag unimplemented methods
 * (E0801) at `check` time instead of letting them throw or misbehave at runtime.
 * Keep this in exact sync with the `switch (method)` cases.
 */
export const KNOWN_METHODS: ReadonlySet<string> = new Set([
  "filter",
  "map",
  "flat-map",
  "size",
  "keys",
  "has",
  "toggle",
  "get",
  "get-or",
  "remove",
  "insert",
  "sort-by",
  "fold",
  "show",
  "is-some",
  "is-none",
  "is-empty",
  "to-ms",
  "copy",
  "find",
  "push",
  "unique",
  "reverse",
  "join",
  "split",
  "contains",
  "starts-with",
  "ends-with",
  "length",
  "slice",
  "trim",
  "format",
  "plus",
  "minus",
  "diff",
  // Issue #5: docs/spec/stdlib.md §2.2 methods that were missing here and therefore
  // wrongly rejected with E0801. All take ≥1 argument, so they always parse as
  // MethodCall (never the parenthesis-free FieldAccess form).
  "concat", // List(T).concat(other)
  "prepend", // List(T).prepend(x)
  "chunk", // List(T).chunk(n)
  "zip", // List(T).zip(other)
  "merge", // Map(K,V).merge(other)
  "update", // Map(K,V).update(k, expr)  — $1 is the current value inside expr
  "add", // Set(T).add(x)
  "union", // Set(T).union(other)
  "intersect", // Set(T).intersect(other)
  "or", // Option(T).or(other) / Result(T,E).or(other)
  "map-err", // Result(T,E).map-err(expr)
  "replace", // Text.replace(from, to)
  "min", // Int/Float.min(b)
  "max", // Int/Float.max(b)
  "clamp", // Int/Float.clamp(lo, hi)
  // Issue #7: docs/spec/stdlib.md §2.2 argument-less methods. These also parse as the
  // parenthesis-free FieldAccess form (handled in jsOfExpr); listing them here
  // makes the `recv.method()` shape compile instead of tripping E0801.
  "head", // List(T).head → Option(T)
  "tail", // List(T).tail → List(T)
  "last", // List(T).last → Option(T)
  "to-list", // Set(T).to-list / Option(T).to-list → List(T)
  "get-err", // Result(T,E).get-err → E (panics if Ok)
  "to-option", // Result(T,E).to-option → Option(T)
  "parse-int", // Text.parse-int → Option(Int)
  "parse-float", // Text.parse-float → Option(Float)
  "abs", // Int/Float.abs
  "neg", // Int/Float.neg
  "to-float", // Int.to-float → Float
  "to-int", // Float.to-int → Int (truncated)
  // ADR-002 symmetry: these are emitted as no-paren FieldAccess shortcuts (see
  // FIELD_ACCESS_SHORTCUTS / jsOfExpr) but were missing here, so their `.m()`
  // form wrongly tripped E0801 while `.m` worked. Listing them makes both shapes
  // agree (and keeps FIELD_ACCESS_SHORTCUTS ⊆ KNOWN_METHODS).
  "is-ok", // Result(T,E).is-ok → Bool
  "is-err", // Result(T,E).is-err → Bool
  "values", // Map(K,V).values → List(V)
  "entries", // Map(K,V).entries → List([K,V])
  "lower", // Text.lower → Text
  "upper", // Text.upper → Text
  "sort", // List(T).sort → List(T)
  "ms", // Time/Duration.ms → Int
]);

/**
 * The method names codegen lowers in the parenthesis-free `recv.m` (FieldAccess)
 * form — kept in sync with the `if (e.field === …)` chain in jsOfExpr's
 * FieldAccess case. A subset of KNOWN_METHODS (enforced by a test): every
 * no-paren shortcut must also accept the `recv.m()` shape.
 */
export const FIELD_ACCESS_SHORTCUTS: ReadonlySet<string> = new Set([
  "get",
  "is-some",
  "is-none",
  "is-ok",
  "is-err",
  "keys",
  "values",
  "entries",
  "size",
  "to-ms",
  "ms",
  "show",
  "length",
  "is-empty",
  "lower",
  "upper",
  "trim",
  "unique",
  "reverse",
  "sort",
  "head",
  "tail",
  "last",
  "to-list",
  "get-err",
  "to-option",
  "parse-int",
  "parse-float",
  "abs",
  "neg",
  "to-float",
  "to-int",
]);

/**
 * Every member name the runtime understands on a stdlib receiver — the union of
 * the method-call methods and the no-paren shortcuts. Used by the type checker
 * (ADR-002) to decide whether `recv.m` on a *known* receiver type is a real
 * member (→ shortcut) or an unknown one (→ E0108). Flat, not per-type.
 */
export const KNOWN_MEMBERS: ReadonlySet<string> = new Set([
  ...KNOWN_METHODS,
  ...FIELD_ACCESS_SHORTCUTS,
]);

function methodCallJs(recv: Expr, method: string, args: Expr[], ctx: EvalCtx): string {
  // Build inner ctx with $1, $2 bound for predicate expression fragments.
  const inner = makeEvalCtx(ctx.gen, ctx.localBinds);
  inner.localBinds.add("$1");
  inner.localBinds.add("$2");

  const recvJs = jsOfExpr(recv, ctx);
  // For list ops, the element may be a plain T or a [K, V] tuple (from .entries).
  // Generate a lambda that binds `$1` and `$2` accordingly: for a 2-tuple we
  // bind ($1=k, $2=v); for any other element we bind $1=elem, $2=undefined.
  const argFnList = (a: Expr): string =>
    `((__x, __y) => { const _isPair = (Array.isArray(__x) && __x.length === 2); const ${jsName("$1")} = _isPair ? __x[0] : __x; const ${jsName("$2")} = _isPair ? __x[1] : (__y !== undefined ? __y : __x); return ${jsOfExpr(a, inner)}; })`;
  // Map predicate form (k, v) → boolean, used by mapFilter's object branch.
  const _argFn = argFnList;
  const argRaw = (a: Expr): string => jsOfExpr(a, ctx);

  switch (method) {
    case "filter":
      // The receiver may be a List (incl. .entries → [k,v] tuples) or a Map.
      // Dispatch at runtime; the lambda destructures tuples and also accepts
      // the (k, v) calling convention used by mapFilter.
      return `_s.filter(${recvJs}, ${argFnList(args[0]!)})`;
    case "map":
      // Polymorphic: List(T).map (over elements, incl. .entries [k,v] tuples)
      // or Option(T).map (over Some). Runtime distinguishes by variant `_tag`.
      return `_s.mapOver(${recvJs}, ${argFnList(args[0]!)})`;
    case "flat-map":
      // Option(T).flat-map(f): Some(v) -> f(v) (which itself returns Option), None -> None.
      return `_s.flatMapOption(${recvJs}, ((${jsName("$1")}) => ${jsOfExpr(args[0]!, inner)}))`;
    case "size":
      return `_s.mapSize(${recvJs})`;
    case "keys":
      return `_s.mapKeys(${recvJs})`;
    case "has":
      return `_s.setHas(${recvJs}, ${argRaw(args[0]!)})`;
    case "toggle":
      return `_s.setToggle(${recvJs}, ${argRaw(args[0]!)})`;
    case "get":
      // Spec: Map(K,V).get returns Option(V). Wrap the raw lookup result.
      return `((_v) => _v === undefined ? _s.None : _s.Some(_v))(_s.mapGet(${recvJs}, ${argRaw(args[0]!)}))`;
    case "get-or":
      // Two shapes:
      //   Option(T).get-or(default)    → returns T (unwrap or default)
      //   Map(K,V).get-or(key, default) → returns V (lookup or default)
      // Dispatch at runtime so we don't need static type info.
      if (args.length === 1) {
        return `_s.getOr(${recvJs}, ${argRaw(args[0]!)})`;
      }
      return `_s.mapGetOr(${recvJs}, ${argRaw(args[0]!)}, ${argRaw(args[1]!)})`;
    case "remove":
      return `_s.mapRemove(${recvJs}, ${argRaw(args[0]!)})`;
    case "insert":
      return `_s.mapInsert(${recvJs}, ${argRaw(args[0]!)}, ${argRaw(args[1]!)})`;
    case "sort-by":
      return `_s.listSortBy(${recvJs}, ${argFnList(args[0]!)})`;
    case "fold":
      // List(T).fold(init, expr) — expr binds $1=acc, $2=elem (distinct from the
      // $1=elem/$2=value convention of filter/map), so emit its own lambda.
      return `_s.listFold(${recvJs}, ${argRaw(args[0]!)}, (${jsName("$1")}, ${jsName("$2")}) => ${jsOfExpr(args[1]!, inner)})`;
    case "show":
      return `_s.show(${recvJs})`;
    case "is-some":
      return `_s.variantIs(${recvJs}, "Some")`;
    case "is-none":
      return `_s.variantIs(${recvJs}, "None")`;
    case "is-empty":
      return `(_s.mapSize(${recvJs}) === 0)`;
    case "to-ms":
      return `(${recvJs})`;
    case "copy":
      // record.copy(field=value, ...) → record with patches
      // args expected to be a single RecordLit with the patch.
      if (args[0] && args[0].kind === "RecordLit") {
        return `_s.recordCopy(${recvJs}, ${jsOfExpr(args[0], ctx)})`;
      }
      return `_s.recordCopy(${recvJs}, {})`;
    case "find":
      return `((${recvJs}) || []).find(${argFnList(args[0]!)})`;
    case "push":
      return `[...(${recvJs} ?? []), ${argRaw(args[0]!)}]`;
    case "unique":
      return `[...new Set((${recvJs} ?? []))]`;
    case "reverse":
      return `[...(${recvJs} ?? [])].reverse()`;
    case "join":
      return `((${recvJs}) ?? []).join(${argRaw(args[0]!)})`;
    case "split":
      return `((${recvJs}) ?? "").split(${argRaw(args[0]!)})`;
    case "contains":
      return `(typeof (${recvJs}) === "string" ? ((${recvJs}) ?? "").includes(${argRaw(args[0]!)}) : ((${recvJs}) ?? []).includes(${argRaw(args[0]!)}))`;
    case "starts-with":
      return `((${recvJs}) ?? "").startsWith(${argRaw(args[0]!)})`;
    case "ends-with":
      return `((${recvJs}) ?? "").endsWith(${argRaw(args[0]!)})`;
    case "length":
      return `((${recvJs}) || "").length`;
    case "slice":
      return `((${recvJs}) || "").slice(${args.map(argRaw).join(", ")})`;
    case "trim":
      return `((${recvJs}) || "").trim()`;
    case "format":
      // Time.format(pattern) — minimal: produce the ISO date portion regardless of pattern.
      return `(new Date(${recvJs})).toISOString().slice(0, 10)`;
    case "plus":
      // Time.plus(durationMs) / Duration.plus — both stored as raw ms numbers.
      return `((${recvJs}) + (${argRaw(args[0]!)}))`;
    case "minus":
      return `((${recvJs}) - (${argRaw(args[0]!)}))`;
    case "diff":
      // Polymorphic: Time/Duration → numeric magnitude; Set(T) → set difference.
      return `_s.diff(${recvJs}, ${argRaw(args[0]!)})`;
    // ----- Issue #5: previously-missing stdlib methods -----
    case "concat":
      // List(T).concat(other)
      return `[...((${recvJs}) ?? []), ...((${argRaw(args[0]!)}) ?? [])]`;
    case "prepend":
      // List(T).prepend(x)
      return `[${argRaw(args[0]!)}, ...((${recvJs}) ?? [])]`;
    case "chunk":
      // List(T).chunk(n) → List(List(T))
      return `_s.listChunk(${recvJs}, ${argRaw(args[0]!)})`;
    case "zip":
      // List(T).zip(other) → List(Tuple(T, U))
      return `_s.listZip(${recvJs}, ${argRaw(args[0]!)})`;
    case "merge":
      // Map(K,V).merge(other) — right side wins on key conflicts. Wrapped in
      // parens so the object literal is safe in arrow-body position.
      return `({ ...((${recvJs}) ?? {}), ...((${argRaw(args[0]!)}) ?? {}) })`;
    case "update":
      // Map(K,V).update(k, expr) — within expr, $1 is the current value.
      return `_s.mapUpdate(${recvJs}, ${argRaw(args[0]!)}, ((${jsName("$1")}) => (${jsOfExpr(args[1]!, inner)})))`;
    case "add":
      // Set(T).add(x)
      return `_s.setAdd(${recvJs}, ${argRaw(args[0]!)})`;
    case "union":
      // Set(T).union(other)
      return `_s.setUnion(${recvJs}, ${argRaw(args[0]!)})`;
    case "intersect":
      // Set(T).intersect(other)
      return `_s.setIntersect(${recvJs}, ${argRaw(args[0]!)})`;
    case "or":
      // Option(T).or(other) / Result(T,E).or(other)
      return `_s.or(${recvJs}, ${argRaw(args[0]!)})`;
    case "map-err":
      // Result(T,E).map-err(expr) — within expr, $1 is the current Err payload.
      return `_s.mapErr(${recvJs}, ((${jsName("$1")}) => (${jsOfExpr(args[0]!, inner)})))`;
    case "replace":
      // Text.replace(from, to) — replaces every occurrence.
      return `String((${recvJs}) ?? "").replaceAll(${argRaw(args[0]!)}, ${argRaw(args[1]!)})`;
    case "min":
      return `Math.min((${recvJs}), (${argRaw(args[0]!)}))`;
    case "max":
      return `Math.max((${recvJs}), (${argRaw(args[0]!)}))`;
    case "clamp":
      // Int/Float.clamp(lo, hi)
      return `Math.min(Math.max((${recvJs}), (${argRaw(args[0]!)})), (${argRaw(args[1]!)}))`;
    // ----- Issue #7: argument-less stdlib methods (parenthesized form). Kept in
    // sync with the FieldAccess (no-paren) cases in jsOfExpr + KNOWN_METHODS. -----
    case "head":
      return `_s.listHead(${recvJs})`;
    case "tail":
      return `_s.listTail(${recvJs})`;
    case "last":
      return `_s.listLast(${recvJs})`;
    case "to-list":
      return `_s.toList(${recvJs})`;
    case "get-err":
      return `_s.getErr(${recvJs})`;
    case "to-option":
      return `_s.toOption(${recvJs})`;
    case "parse-int":
      return `_s.parseIntOpt(${recvJs})`;
    case "parse-float":
      return `_s.parseFloatOpt(${recvJs})`;
    case "abs":
      return `Math.abs(${recvJs})`;
    case "neg":
      return `(-(${recvJs}))`;
    case "to-float":
      return `(${recvJs})`;
    case "to-int":
      return `Math.trunc(${recvJs})`;
    default:
      // generic fallback: receiver.method(...args)
      return `(${recvJs}).${jsName(method)}(${args.map(argRaw).join(", ")})`;
  }
}

function variantJs(name: string, payload: Expr[], ctx: EvalCtx): string {
  // Treat capital-letter bare ident as a variant tag (already in payload form).
  if (payload.length === 0) {
    if (name === "None") return `_s.None`;
    return `({ _tag: ${JSON.stringify(name)} })`;
  }
  if (name === "Some") return `_s.Some(${jsOfExpr(payload[0]!, ctx)})`;
  if (name === "Ok") return `_s.Ok(${jsOfExpr(payload[0]!, ctx)})`;
  if (name === "Err") return `_s.Err(${jsOfExpr(payload[0]!, ctx)})`;
  return `_s.variant(${JSON.stringify(name)}, ${payload.map((p) => jsOfExpr(p, ctx)).join(", ")})`;
}

function matchExprJs(e: Expr & { kind: "MatchExpr" }, ctx: EvalCtx): string {
  const sc = jsOfExpr(e.scrutinee, ctx);
  // Generate an IIFE that destructures the scrutinee and matches each arm.
  const armsJs = e.arms.map((arm) => matchArmJs(arm.pattern, arm.body, ctx, "_v")).join(" else ");
  return `((_v) => { ${armsJs} else { return undefined; } })(${sc})`;
}

function matchArmJs(p: Pattern, body: Expr, ctx: EvalCtx, scVar: string): string {
  if (p.kind === "PWildcard") {
    return `if (true) { return ${jsOfExpr(body, ctx)}; }`;
  }
  if (p.kind === "PBind") {
    const inner = makeEvalCtx(ctx.gen, ctx.localBinds);
    inner.localBinds.add(p.name);
    return `if (true) { const ${jsName(p.name)} = ${scVar}; return ${jsOfExpr(body, inner)}; }`;
  }
  if (p.kind === "PLiteral") {
    return `if (${scVar} === ${JSON.stringify(p.value)}) { return ${jsOfExpr(body, ctx)}; }`;
  }
  // PVariant
  const tag = p.name;
  const inner = makeEvalCtx(ctx.gen, ctx.localBinds);
  const bindAssigns: string[] = [];
  for (let i = 0; i < p.binds.length; i++) {
    const name = p.binds[i]!;
    if (name === "_") continue;
    inner.localBinds.add(name);
    bindAssigns.push(`const ${jsName(name)} = (${scVar})[${JSON.stringify(`_${i}`)}];`);
  }
  return `if (_s.variantIs(${scVar}, ${JSON.stringify(tag)})) { ${bindAssigns.join(" ")} return ${jsOfExpr(body, inner)}; }`;
}

// ----- tiles -----

function genTile(tile: TileDef, gen: GenCtx): string {
  const ctx = makeEvalCtx(gen, new Set(tile.in ? ["$1"] : []));
  return tileExprJs(tile.body, gen, ctx, tile.name);
}

function tileExprJs(t: TileExpr, gen: GenCtx, ctx: EvalCtx, enclosingTile?: string): string {
  switch (t.kind) {
    case "TileFor": {
      const iter = jsOfExpr(t.iter, ctx);
      const inner = makeEvalCtx(gen, ctx.localBinds);
      inner.localBinds.add(t.bind);
      // Returns Array<Node|Node[]>. Caller (collectChildren / _children) flattens.
      return `((${iter}) || []).map((${jsName(t.bind)}) => (${tileExprJs(t.body, gen, inner, enclosingTile)}))`;
    }
    case "TileWhen":
      // Returns a Node or null. Caller flattens nulls away.
      return `((${jsOfExpr(t.cond, ctx)}) ? (${tileExprJs(t.body, gen, ctx, enclosingTile)}) : null)`;
    case "TileIf":
      return `((${jsOfExpr(t.cond, ctx)}) ? (${tileExprJs(t.consequent, gen, ctx, enclosingTile)}) : (${tileExprJs(t.alternate, gen, ctx, enclosingTile)}))`;
    case "TileMatch": {
      const sc = jsOfExpr(t.scrutinee, ctx);
      const arms = t.arms
        .map((arm) => {
          if (arm.pattern.kind === "PVariant") {
            const inner = makeEvalCtx(gen, ctx.localBinds);
            for (const b of arm.pattern.binds) if (b !== "_") inner.localBinds.add(b);
            const binds = arm.pattern.binds
              .map((b, i) =>
                b !== "_" ? `const ${jsName(b)} = _v[${JSON.stringify(`_${i}`)}];` : "",
              )
              .join(" ");
            return `if (_s.variantIs(_v, ${JSON.stringify(arm.pattern.name)})) { ${binds} return ${tileExprJs(arm.body, gen, inner, enclosingTile)}; }`;
          }
          if (arm.pattern.kind === "PBind") {
            const inner = makeEvalCtx(gen, ctx.localBinds);
            inner.localBinds.add(arm.pattern.name);
            return `if (true) { const ${jsName(arm.pattern.name)} = _v; return ${tileExprJs(arm.body, gen, inner, enclosingTile)}; }`;
          }
          if (arm.pattern.kind === "PWildcard") {
            return `if (true) { return ${tileExprJs(arm.body, gen, ctx, enclosingTile)}; }`;
          }
          return `if (_v === ${JSON.stringify(arm.pattern.value)}) { return ${tileExprJs(arm.body, gen, ctx, enclosingTile)}; }`;
        })
        .join(" else ");
      return `((_v) => { ${arms} else { return { kind: "text", text: "" }; } })(${sc})`;
    }
    case "TileCall":
      return tileCallJs(t as TileExpr & { kind: "TileCall" }, gen, ctx, enclosingTile);
  }
}

const BUILTIN_TILES = new Set([
  "page",
  "row",
  "column",
  "card",
  "box",
  "panel",
  "grid",
  "stack",
  "overlay",
  "region",
  "scroll",
  "divider",
  "fieldset",
  "heading",
  "text",
  "button",
  "form",
  "input",
  "textarea",
  "label",
  "check",
  "spinner",
  "select",
  "radio",
  "slider",
  "switch",
  "link",
  "markdown",
  "skeleton",
  "image",
  "icon",
]);

/**
 * For `bind=draft` or `bind=draft.title.deeper`, extract the root slot name,
 * the static path (string field names), and a JS expression to read the value.
 * Only static field-access paths are supported (no Index, no dynamic lookups).
 * Returns null if no `bind=` arg exists or the path isn't statically resolvable.
 */
function extractBindPath(
  args: { name?: string; value: unknown }[],
): { root: string; path: string[]; readJs: string; readJsRaw: string } | null {
  const bindArg = args.find((a) => a.name === "bind");
  if (!bindArg) return null;
  let cur = bindArg.value as Expr;
  const reverseSegments: string[] = [];
  while (cur.kind === "FieldAccess") {
    reverseSegments.push((cur as Expr & { field: string }).field);
    cur = (cur as Expr & { base: Expr }).base;
  }
  if (cur.kind !== "Ref") return null;
  const root = (cur as Expr & { name: string }).name;
  const path = reverseSegments.reverse();
  // Build a safe reader: `((_live["root"] ?? {})["a"] ?? {})["b"] ...` then unwrap.
  let readRaw = `_live[${JSON.stringify(root)}]`;
  for (const seg of path) {
    readRaw = `((${readRaw}) ?? {})[${JSON.stringify(seg)}]`;
  }
  return { root, path, readJs: readRaw, readJsRaw: readRaw };
}

function tileCallJs(
  t: TileExpr & { kind: "TileCall" },
  gen: GenCtx,
  ctx: EvalCtx,
  enclosingTile?: string,
): string {
  const name = t.name;

  if (!BUILTIN_TILES.has(name)) {
    const def = gen.tiles.find((x) => x.name === name);
    if (!def) throw new Error(`Tile "${name}" not found`);
    const inner = makeEvalCtx(gen, ctx.localBinds);
    const arg1 = t.args[0];
    const TILE_KINDS = new Set(["TileCall", "TileFor", "TileWhen", "TileIf", "TileMatch"]);
    const wrapBoundary = (body: string): string => {
      if (!def.errorBoundary) return body;
      const fb = gen.tiles.find((x) => x.name === def.errorBoundary);
      if (!fb) return body;
      const fbCtx = makeEvalCtx(gen, new Set(["$1"]));
      const fbBody = tileExprJs(fb.body, gen, fbCtx, fb.name);
      return `((() => { try { return ${body}; } catch (_err) { const ${jsName("$1")} = { message: String(_err && _err.message || _err), location: ${JSON.stringify(def.name)} }; return ${fbBody}; } })())`;
    };
    if (arg1) {
      const v = arg1.value;
      const isTile = TILE_KINDS.has((v as { kind?: string }).kind ?? "");
      if (isTile) {
        return wrapBoundary(tileExprJs(v as TileExpr, gen, inner, def.name));
      }
      // Evaluate the positional arg and props in the OUTER context (where
      // `_d_1` still refers to the enclosing tile's `$1`), then pass them in
      // as arguments so the inner IIFE can rebind `_d_1` without colliding
      // with the outer scope.
      const oneJs = jsOfExpr(v as Expr, ctx);
      const propsJs = propsFor(t, ctx);
      const bodyJs = tileExprJs(def.body, gen, addBind(inner, "$1"), def.name);
      return wrapBoundary(
        `((_arg, _propsOuter) => { const ${jsName("$1")} = _arg; return _attachProps(${bodyJs}, _propsOuter); })(${oneJs}, ${propsJs})`,
      );
    }
    const propsJs = propsFor(t, ctx);
    const bodyJs = tileExprJs(def.body, gen, inner, def.name);
    return wrapBoundary(`(_attachProps(${bodyJs}, ${propsJs}))`);
  }

  // Builtin tiles
  const propsObj = propsFor(t, ctx, enclosingTile);
  switch (name) {
    case "page":
    case "row":
    case "column":
    case "card":
    case "box":
    case "grid":
    case "stack":
    case "overlay":
    case "region":
    case "scroll":
    case "divider":
    case "fieldset":
    case "panel": {
      const children = collectChildren(t.args, gen, ctx, enclosingTile);
      return `({ kind: ${JSON.stringify(name)}, children: [${children}], props: ${propsObj} })`;
    }
    case "heading": {
      const text = t.args[0] ? jsOfExpr(asExpr(t.args[0].value), ctx) : '""';
      return `({ kind: "heading", text: _s.show(${text}), props: ${propsObj} })`;
    }
    case "text": {
      const text = t.args[0] ? jsOfExpr(asExpr(t.args[0].value), ctx) : '""';
      return `({ kind: "text", text: _s.show(${text}), props: ${propsObj} })`;
    }
    case "button": {
      const textArg = t.args.find((a) => a.name === "text");
      const textJs = textArg ? jsOfExpr(asExpr(textArg.value), ctx) : '""';
      return `({ kind: "button", text: _s.show(${textJs}), props: ${propsObj} })`;
    }
    case "input": {
      const fields: string[] = [`kind: "input"`];
      const bindInfo = extractBindPath(t.args);
      for (const arg of t.args) {
        if (!arg.name || arg.name === "bind") continue;
        const valJs = jsOfExpr(asExpr(arg.value), ctx);
        if (arg.name === "value") fields.push(`value: _s.show(${valJs})`);
        else if (arg.name === "placeholder") fields.push(`placeholder: ${valJs}`);
        else if (arg.name === "type") fields.push(`type: ${valJs}`);
        else if (arg.name === "id") fields.push(`id: ${valJs}`);
        else if (arg.name === "auto-focus") fields.push(`autoFocus: ${valJs}`);
        else if (arg.name === "required") fields.push(`required: ${valJs}`);
      }
      if (bindInfo) {
        fields.push(`bind: ${JSON.stringify(bindInfo.root)}`);
        if (bindInfo.path.length > 0) {
          fields.push(`bindPath: ${JSON.stringify(bindInfo.path)}`);
        }
        fields.push(`value: _s.show(${bindInfo.readJs})`);
      }
      fields.push(`props: ${propsObj}`);
      return `({ ${fields.join(", ")} })`;
    }
    case "textarea": {
      const fields: string[] = [`kind: "textarea"`];
      const bindInfo = extractBindPath(t.args);
      for (const arg of t.args) {
        if (!arg.name || arg.name === "bind") continue;
        const valJs = jsOfExpr(asExpr(arg.value), ctx);
        if (arg.name === "value") fields.push(`value: _s.show(${valJs})`);
        else if (arg.name === "placeholder") fields.push(`placeholder: ${valJs}`);
        else if (arg.name === "id") fields.push(`id: ${valJs}`);
        else if (arg.name === "rows") fields.push(`rows: ${valJs}`);
      }
      if (bindInfo) {
        fields.push(`bind: ${JSON.stringify(bindInfo.root)}`);
        if (bindInfo.path.length > 0) {
          fields.push(`bindPath: ${JSON.stringify(bindInfo.path)}`);
        }
        fields.push(`value: _s.show(${bindInfo.readJs})`);
      }
      fields.push(`props: ${propsObj}`);
      return `({ ${fields.join(", ")} })`;
    }
    case "check": {
      const valArg = t.args.find((a) => a.name === "value");
      const checked = valArg ? jsOfExpr(asExpr(valArg.value), ctx) : "false";
      return `({ kind: "check", checked: !!(${checked}), props: ${propsObj} })`;
    }
    case "select": {
      const fields: string[] = [`kind: "select"`];
      const bindInfo = extractBindPath(t.args);
      if (bindInfo) {
        fields.push(`bind: ${JSON.stringify(bindInfo.root)}`);
        if (bindInfo.path.length > 0) {
          fields.push(`bindPath: ${JSON.stringify(bindInfo.path)}`);
        }
        fields.push(`value: ${bindInfo.readJsRaw}`);
      } else {
        // No bind=; allow `value=<expr>` for read-only / dispatch-via-reducer selects.
        const valArg = t.args.find((a) => a.name === "value");
        if (valArg) fields.push(`value: ${jsOfExpr(asExpr(valArg.value), ctx)}`);
      }
      const optionsArg = t.args.find((a) => a.name === "options");
      if (optionsArg) {
        fields.push(`options: ${jsOfExpr(asExpr(optionsArg.value), ctx)}`);
      } else {
        fields.push(`options: []`);
      }
      const placeholderArg = t.args.find((a) => a.name === "placeholder");
      if (placeholderArg) {
        fields.push(`placeholder: ${jsOfExpr(asExpr(placeholderArg.value), ctx)}`);
      }
      fields.push(`props: ${propsObj}`);
      return `({ ${fields.join(", ")} })`;
    }
    case "radio": {
      const fields: string[] = [`kind: "radio"`];
      for (const arg of t.args) {
        if (!arg.name) continue;
        const valJs = jsOfExpr(asExpr(arg.value), ctx);
        if (arg.name === "group") fields.push(`group: ${valJs}`);
        else if (arg.name === "value") fields.push(`value: ${valJs}`);
        else if (arg.name === "selected") fields.push(`selected: !!(${valJs})`);
      }
      fields.push(`props: ${propsObj}`);
      return `({ ${fields.join(", ")} })`;
    }
    case "spinner":
      return `({ kind: "spinner", props: ${propsObj} })`;
    case "form": {
      const children = collectChildren(t.args, gen, ctx, enclosingTile);
      return `({ kind: "form", children: [${children}], props: ${propsObj} })`;
    }
    case "label": {
      const text = t.args.find((a) => a.name === "text");
      const textJs = text ? jsOfExpr(asExpr(text.value), ctx) : '""';
      return `({ kind: "label", text: _s.show(${textJs}), props: ${propsObj} })`;
    }
    case "link": {
      const toArg = t.args.find((a) => a.name === "to");
      const to = toArg ? jsOfExpr(asExpr(toArg.value), ctx) : '""';
      const textProp = t.props.find((p) => p.name === "text");
      const text = textProp ? jsOfExpr(textProp.value, ctx) : '""';
      return `({ kind: "link", text: _s.show(${text}), to: _s.show(${to}), props: ${propsObj} })`;
    }
    case "markdown": {
      const text = t.args[0] ? jsOfExpr(asExpr(t.args[0].value), ctx) : '""';
      return `({ kind: "markdown", text: _s.show(${text}), props: ${propsObj} })`;
    }
    case "skeleton":
      return `({ kind: "skeleton", props: ${propsObj} })`;
    case "image": {
      const src = t.args.find((a) => a.name === "src");
      const srcJs = src ? jsOfExpr(asExpr(src.value), ctx) : '""';
      return `({ kind: "image", src: _s.show(${srcJs}), props: ${propsObj} })`;
    }
    case "icon": {
      const name = t.args.find((a) => a.name === "name");
      const nameJs = name ? jsOfExpr(asExpr(name.value), ctx) : '""';
      return `({ kind: "icon", name: _s.show(${nameJs}), props: ${propsObj} })`;
    }
  }
  throw new Error(`Unsupported builtin tile "${name}"`);
}

function asExpr(v: Expr | TileExpr): Expr {
  return v as Expr;
}

function collectChildren(
  args: { kind: "TileArg"; name?: string; value: Expr | TileExpr }[],
  gen: GenCtx,
  ctx: EvalCtx,
  enclosingTile?: string,
): string {
  const parts: string[] = [];
  for (const a of args) {
    if (a.name) continue; // skip named args at container level
    const v = a.value;
    if (
      (v as TileExpr).kind === "TileCall" ||
      (v as TileExpr).kind === "TileFor" ||
      (v as TileExpr).kind === "TileWhen" ||
      (v as TileExpr).kind === "TileIf" ||
      (v as TileExpr).kind === "TileMatch"
    ) {
      parts.push(tileExprJs(v as TileExpr, gen, ctx, enclosingTile));
    } else if ((v as Expr).kind === "Ref") {
      const refName = (v as Expr & { name: string }).name;
      const def = gen.tiles.find((x) => x.name === refName);
      if (def) {
        parts.push(tileExprJs(def.body, gen, ctx, def.name));
      } else {
        parts.push("null");
      }
    }
  }
  // Wrap in _children(...) so the runtime can flatten arrays and drop nulls.
  return `..._children(${parts.join(", ")})`;
}

function propsFor(
  t: TileExpr & { kind: "TileCall" },
  ctx: EvalCtx,
  enclosingTile?: string,
): string {
  const entries: string[] = [];
  // event handler args (onClick=remove etc) attach as props for that tile.
  for (const a of t.args) {
    if (!a.name) continue;
    if (
      a.name === "onClick" ||
      a.name === "onSubmit" ||
      a.name === "onChange" ||
      a.name === "onInput"
    ) {
      if ((a.value as Expr).kind === "Ref") {
        const reducerName = (a.value as Expr & { name: string }).name;
        entries.push(
          `${a.name}: (el) => globalThis.__kumikiApp._dispatch(${JSON.stringify(reducerName)}, el)`,
        );
      }
    }
  }
  // props block
  for (const p of t.props) {
    if (
      p.name === "onClick" ||
      p.name === "onSubmit" ||
      p.name === "onChange" ||
      p.name === "onInput"
    ) {
      if ((p.value as Expr).kind === "Ref") {
        const reducerName = (p.value as Expr as Expr & { name: string }).name;
        entries.push(
          `${p.name}: (el) => globalThis.__kumikiApp._dispatch(${JSON.stringify(reducerName)}, el)`,
        );
      }
      continue;
    }
    // event handler from enclosing tile (e.g. ResetBtn has no onClick but reducer subscribes to ui.click(ResetBtn))
    entries.push(`${jsName(p.name)}: ${jsOfExpr(p.value, ctx)}`);
  }
  // Implicit onClick from reducers subscribing to this enclosing tile name (matches Phase 1 behavior)
  if (t.name === "button" && enclosingTile) {
    const r = ctx.gen.reducers.find(
      (rr) =>
        rr.on.kind === "UiEvent" && rr.on.ev === "click" && rr.on.selector.tile === enclosingTile,
    );
    if (r && !entries.some((e) => e.startsWith("onClick"))) {
      entries.push(
        `onClick: (el) => globalThis.__kumikiApp._dispatch(${JSON.stringify(r.name)}, el)`,
      );
    }
  }
  // Implicit onClick for `check` when reducer subscribes via enclosing tile (e.g. TodoRow → toggle)
  if (t.name === "check" && enclosingTile) {
    const r = ctx.gen.reducers.find(
      (rr) =>
        rr.on.kind === "UiEvent" && rr.on.ev === "click" && rr.on.selector.tile === enclosingTile,
    );
    if (r && !entries.some((e) => e.startsWith("onClick"))) {
      entries.push(
        `onClick: (el) => globalThis.__kumikiApp._dispatch(${JSON.stringify(r.name)}, el)`,
      );
    }
  }
  // Implicit onSubmit for form when reducer subscribes to enclosing user tile
  if (t.name === "form" && enclosingTile) {
    const r = ctx.gen.reducers.find(
      (rr) =>
        rr.on.kind === "UiEvent" && rr.on.ev === "submit" && rr.on.selector.tile === enclosingTile,
    );
    if (r)
      entries.push(
        `onSubmit: (el) => globalThis.__kumikiApp._dispatch(${JSON.stringify(r.name)}, el)`,
      );
  }
  // Implicit onChange for select / input / textarea when reducer subscribes to ui.change(EnclosingTile)
  if ((t.name === "select" || t.name === "input" || t.name === "textarea") && enclosingTile) {
    const r = ctx.gen.reducers.find(
      (rr) =>
        rr.on.kind === "UiEvent" && rr.on.ev === "change" && rr.on.selector.tile === enclosingTile,
    );
    if (r && !entries.some((e) => e.startsWith("onChange"))) {
      entries.push(
        `onChange: (el) => globalThis.__kumikiApp._dispatch(${JSON.stringify(r.name)}, el)`,
      );
    }
  }
  // Implicit onInput for input / textarea when reducer subscribes to ui.input(EnclosingTile)
  if ((t.name === "input" || t.name === "textarea") && enclosingTile) {
    const r = ctx.gen.reducers.find(
      (rr) =>
        rr.on.kind === "UiEvent" && rr.on.ev === "input" && rr.on.selector.tile === enclosingTile,
    );
    if (r && !entries.some((e) => e.startsWith("onInput"))) {
      entries.push(
        `onInput: (el) => globalThis.__kumikiApp._dispatch(${JSON.stringify(r.name)}, el)`,
      );
    }
  }
  // Build `el` from explicit {key: expr} that aren't handlers
  const elProps: string[] = [];
  for (const p of t.props) {
    if (
      p.name === "onClick" ||
      p.name === "onSubmit" ||
      p.name === "onChange" ||
      p.name === "onInput"
    )
      continue;
    elProps.push(`${jsName(p.name)}: ${jsOfExpr(p.value, ctx)}`);
  }
  if (elProps.length > 0) {
    entries.push(`el: { ${elProps.join(", ")} }`);
  }
  return `{ ${entries.join(", ")} }`;
}

function addBind(ctx: EvalCtx, name: string): EvalCtx {
  const out = makeEvalCtx(ctx.gen, ctx.localBinds);
  out.localBinds.add(name);
  return out;
}

// ----- helpers -----

function jsName(name: string): string {
  // Map kebab-case and Kumiki-special names to safe JS identifiers.
  return name.replace(/^\$/, "_d_").replace(/-/g, "_").replace(/\./g, "_");
}

function refinementJs(t: TypeExpr, gen: GenCtx): string | undefined {
  let target = t;
  if (t.kind === "TypeRef") {
    const def = gen.types.get(t.name);
    if (!def) return undefined;
    target = def.body;
  }
  if (target.kind === "TypeNominal" || target.kind === "TypeRefinement") {
    const r = (target as { refinement?: Refinement }).refinement;
    if (r) return refinementToJs(r);
  }
  return undefined;
}

function refinementToJs(r: Refinement): string | undefined {
  switch (r.pred) {
    case "between": {
      const a = r.args[0] as number;
      const b = r.args[1] as number;
      return `(v) => typeof v === "number" && v >= ${a} && v <= ${b}`;
    }
    case "nonempty":
      return `(v) => typeof v === "string" && v.length > 0`;
    case "len-lt":
      return `(v) => typeof v === "string" && v.length < ${r.args[0] as number}`;
    case "len-gt":
      return `(v) => typeof v === "string" && v.length > ${r.args[0] as number}`;
    case "len-eq":
      return `(v) => typeof v === "string" && v.length === ${r.args[0] as number}`;
    default:
      return `(_v) => true`;
  }
}

function emitFromInitExpr(e: Expr): string {
  if (e.kind === "Call") {
    return `{ effect: ${JSON.stringify(e.callee)}, args: [${e.args.map((a) => jsOfExpr(a, { gen: {} as GenCtx, localBinds: new Set() })).join(", ")}] }`;
  }
  return "null";
}

export const RUNTIME_HELPERS = `
function _setPath(obj, path, value) {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  const cur = obj ?? {};
  return { ...cur, [head]: _setPath(cur[head], rest, value) };
}
function _children(...xs) {
  const out = [];
  for (const x of xs) {
    if (x === null || x === undefined) continue;
    if (Array.isArray(x)) {
      for (const y of x) if (y !== null && y !== undefined) out.push(y);
    } else {
      out.push(x);
    }
  }
  return out;
}
function _attachProps(node, props) {
  if (!node || !props) return node;
  return { ...node, props: { ...(node.props || {}), ...props } };
}
`;
