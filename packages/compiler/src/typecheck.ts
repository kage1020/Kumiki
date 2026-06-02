import type {
  AppDef,
  EffectDef,
  Expr,
  FnDef,
  Lvalue,
  Pos,
  Program,
  ReducerDef,
  SlotDef,
  Statement,
  TileDef,
  TileExpr,
  TypeDef,
  TypeExpr,
} from "./ast.ts";
import { KNOWN_METHODS } from "./codegen.ts";

export type KumikiError = {
  code: string;
  kind: string;
  message: string;
  pos: Pos;
};

const BUILTIN_TILES = new Set([
  "page",
  "region",
  "row",
  "column",
  "stack",
  "overlay",
  "grid",
  "box",
  "card",
  "panel",
  "divider",
  "scroll",
  "text",
  "heading",
  "link",
  "code",
  "markdown",
  "image",
  "icon",
  "video",
  "button",
  "input",
  "textarea",
  "check",
  "radio",
  "select",
  "slider",
  "switch",
  "form",
  "label",
  "fieldset",
  "error",
  "list",
  "list-item",
  "table",
  "table-head",
  "table-body",
  "table-row",
  "table-cell",
  "modal",
  "drawer",
  "tooltip",
  "popover",
  "toast",
  "spinner",
  "progress",
  "skeleton",
  "route-outlet",
]);

const A11Y_CODES = new Set(["E0701", "E0702", "E0703"]);

/** Returns errors with a11y warnings filtered out (unless strict). */
export function check(program: Program, opts?: { strictA11y?: boolean }): KumikiError[] {
  const errors = checkAll(program);
  if (opts?.strictA11y) return errors;
  return errors.filter((e) => !A11Y_CODES.has(e.code));
}

type SymbolTable = {
  types: Map<string, TypeDef>;
  slots: Map<string, SlotDef>;
  reducers: Map<string, ReducerDef>;
  tiles: Map<string, TileDef>;
  fns: Map<string, FnDef>;
  effects: Map<string, EffectDef>;
  /** Names declared by `timer(d, name=N)` triggers — the `stop-timer` namespace. */
  timerNames: Set<string>;
  app?: AppDef;
};

function checkAll(program: Program): KumikiError[] {
  const errors: KumikiError[] = [];
  const sym: SymbolTable = {
    types: new Map(),
    slots: new Map(),
    reducers: new Map(),
    tiles: new Map(),
    fns: new Map(),
    effects: new Map(),
    timerNames: new Set(),
  };

  for (const def of program.defs) {
    switch (def.kind) {
      case "TypeDef":
        sym.types.set(def.name, def);
        break;
      case "SlotDef":
        sym.slots.set(def.name, def);
        break;
      case "ReducerDef":
        sym.reducers.set(def.name, def);
        if (def.on.kind === "TimerEvent" && def.on.name !== undefined) {
          if (sym.timerNames.has(def.on.name)) {
            errors.push({
              code: "E0002",
              kind: "duplicate-timer-name",
              message: `Timer name "${def.on.name}" is declared more than once`,
              pos: def.on.pos,
            });
          } else {
            sym.timerNames.add(def.on.name);
          }
        }
        break;
      case "TileDef":
        sym.tiles.set(def.name, def);
        break;
      case "FnDef":
        sym.fns.set(def.name, def);
        break;
      case "EffectDef":
        sym.effects.set(def.name, def);
        break;
      case "AppDef":
        sym.app = def;
        break;
    }
  }

  for (const def of program.defs) {
    if (def.kind === "SlotDef") checkSlot(def, sym, errors);
    if (def.kind === "TileDef") checkTile(def, sym, errors);
    if (def.kind === "ReducerDef") checkReducer(def, sym, errors);
    if (def.kind === "FnDef") checkFn(def, sym, errors);
    if (def.kind === "EffectDef") checkEffect(def, sym, errors);
    if (def.kind === "AppDef") checkApp(def, sym, errors);
  }

  return errors;
}

function checkSlot(slot: SlotDef, sym: SymbolTable, errors: KumikiError[]): void {
  resolveType(slot.type, sym, errors);
  checkExpr(slot.init, sym, errors, { kind: "slot-init", localBinds: new Set() });
}

function checkTile(tile: TileDef, sym: SymbolTable, errors: KumikiError[]): void {
  const ctx: Ctx = { kind: "tile", localBinds: new Set() };
  if (tile.in) ctx.localBinds.add("$1");
  checkTileExpr(tile.body, sym, errors, ctx);
}

type Ctx = {
  kind: "slot-init" | "tile" | "reducer" | "fn";
  localBinds: Set<string>;
  capsAvailable?: Set<string>; // for reducer context
};

function checkA11y(t: TileExpr & { kind: "TileCall" }, errors: KumikiError[]): void {
  if (t.name === "button") {
    const hasText = t.args.some((a) => a.name === "text");
    const hasAria = t.props.some((p) => p.name === "aria-label");
    if (!hasText && !hasAria) {
      errors.push({
        code: "E0701",
        kind: "a11y-button",
        message: `button must have a text= argument or aria-label prop`,
        pos: t.pos,
      });
    }
  }
  if (t.name === "image") {
    const hasAlt = t.args.some((a) => a.name === "alt") || t.props.some((p) => p.name === "alt");
    if (!hasAlt) {
      errors.push({
        code: "E0702",
        kind: "a11y-image",
        message: `image must have an alt prop`,
        pos: t.pos,
      });
    }
  }
  if (t.name === "link") {
    const hasText = t.args.some((a) => a.name === "text") || t.props.some((p) => p.name === "text");
    const hasAria = t.props.some((p) => p.name === "aria-label");
    if (!hasText && !hasAria) {
      errors.push({
        code: "E0703",
        kind: "a11y-link",
        message: `link must have inner text or aria-label`,
        pos: t.pos,
      });
    }
  }
}

function checkTileExpr(t: TileExpr, sym: SymbolTable, errors: KumikiError[], ctx: Ctx): void {
  switch (t.kind) {
    case "TileFor": {
      checkExpr(t.iter, sym, errors, ctx);
      const inner: Ctx = { ...ctx, localBinds: new Set(ctx.localBinds) };
      inner.localBinds.add(t.bind);
      checkTileExpr(t.body, sym, errors, inner);
      return;
    }
    case "TileWhen":
      checkExpr(t.cond, sym, errors, ctx);
      checkTileExpr(t.body, sym, errors, ctx);
      return;
    case "TileIf":
      checkExpr(t.cond, sym, errors, ctx);
      checkTileExpr(t.consequent, sym, errors, ctx);
      checkTileExpr(t.alternate, sym, errors, ctx);
      return;
    case "TileMatch":
      checkExpr(t.scrutinee, sym, errors, ctx);
      for (const arm of t.arms) {
        const inner: Ctx = { ...ctx, localBinds: new Set(ctx.localBinds) };
        if (arm.pattern.kind === "PVariant")
          for (const b of arm.pattern.binds) inner.localBinds.add(b);
        if (arm.pattern.kind === "PBind") inner.localBinds.add(arm.pattern.name);
        checkTileExpr(arm.body, sym, errors, inner);
      }
      return;
    case "TileCall":
      checkTileCall(t, sym, errors, ctx);
      return;
  }
}

function checkTileCall(
  t: TileExpr & { kind: "TileCall" },
  sym: SymbolTable,
  errors: KumikiError[],
  ctx: Ctx,
): void {
  if (!BUILTIN_TILES.has(t.name) && !sym.tiles.has(t.name)) {
    errors.push({
      code: "E0105",
      kind: "undef-tile",
      message: `Reference to undefined tile "${t.name}"`,
      pos: t.pos,
    });
  }
  checkA11y(t, errors);
  const HANDLER_NAMES = new Set([
    "onClick",
    "onSubmit",
    "onChange",
    "onInput",
    "onFocus",
    "onBlur",
  ]);
  for (const arg of t.args) {
    const v = arg.value;
    if (
      (v as TileExpr).kind === "TileCall" ||
      (v as TileExpr).kind === "TileFor" ||
      (v as TileExpr).kind === "TileWhen" ||
      (v as TileExpr).kind === "TileIf" ||
      (v as TileExpr).kind === "TileMatch"
    ) {
      checkTileExpr(v as TileExpr, sym, errors, ctx);
      continue;
    }
    // Named arg whose name is an event-handler binds a reducer rather than a slot ref.
    if (arg.name && HANDLER_NAMES.has(arg.name)) {
      const expr = v as Expr;
      if (expr.kind !== "Ref") {
        errors.push({
          code: "E0201",
          kind: "type-mismatch",
          message: `Event handler arg "${arg.name}" must be a reducer name`,
          pos: expr.pos,
        });
      } else if (!sym.reducers.has(expr.name)) {
        errors.push({
          code: "E0102",
          kind: "undef-reducer",
          message: `Reference to undefined reducer "${expr.name}"`,
          pos: expr.pos,
        });
      }
      continue;
    }
    checkExpr(v as Expr, sym, errors, ctx);
  }
  for (const prop of t.props) {
    if (HANDLER_NAMES.has(prop.name)) {
      const ref = prop.value;
      if (ref.kind !== "Ref") {
        errors.push({
          code: "E0201",
          kind: "type-mismatch",
          message: `Event handler prop "${prop.name}" must be a reducer name`,
          pos: prop.value.pos,
        });
      } else if (!sym.reducers.has(ref.name)) {
        errors.push({
          code: "E0102",
          kind: "undef-reducer",
          message: `Reference to undefined reducer "${ref.name}"`,
          pos: ref.pos,
        });
      }
    } else {
      checkExpr(prop.value, sym, errors, ctx);
    }
  }
}

function checkReducer(r: ReducerDef, sym: SymbolTable, errors: KumikiError[]): void {
  const ctx: Ctx = {
    kind: "reducer",
    localBinds: new Set(),
    capsAvailable: new Set(sym.app?.caps ?? []),
  };
  // event binds
  if (r.on.kind === "EffectEvent") {
    for (const b of r.on.binds) if (b !== "_") ctx.localBinds.add(b);
  }
  if (r.on.kind === "LifecycleEvent") {
    if (r.on.name.startsWith("route.")) ctx.localBinds.add("$route");
  }
  ctx.localBinds.add("$el");
  ctx.localBinds.add("$event");
  ctx.localBinds.add("$route");

  const writtenRoots = new Set<string>();
  for (const stmt of r.do) checkStmt(stmt, sym, errors, ctx, writtenRoots);
}

function checkStmt(
  s: Statement,
  sym: SymbolTable,
  errors: KumikiError[],
  ctx: Ctx,
  writtenRoots: Set<string>,
): void {
  if (s.kind === "ForStmt") {
    checkExpr(s.iter, sym, errors, ctx);
    const inner: Ctx = { ...ctx, localBinds: new Set(ctx.localBinds) };
    inner.localBinds.add(s.bind);
    // A loop body executes multiple times; track writes inside its own scope
    // so the same slot can be assigned once per iteration. After the loop,
    // propagate the write set up to the parent (the slot WAS written).
    const bodyWrites = new Set<string>(writtenRoots);
    for (const st of s.body) checkStmt(st, sym, errors, inner, bodyWrites);
    for (const r of bodyWrites) writtenRoots.add(r);
    return;
  }
  if (s.kind === "IfStmt") {
    checkExpr(s.cond, sym, errors, ctx);
    // then/else are exclusive — each branch starts from the parent write set.
    // A slot written in only one branch (or both) counts as "written" for the
    // parent, so subsequent code can't re-write it.
    const thenWrites = new Set<string>(writtenRoots);
    for (const st of s.consequent) checkStmt(st, sym, errors, ctx, thenWrites);
    const elseWrites = new Set<string>(writtenRoots);
    for (const st of s.alternate) checkStmt(st, sym, errors, ctx, elseWrites);
    for (const r of thenWrites) writtenRoots.add(r);
    for (const r of elseWrites) writtenRoots.add(r);
    return;
  }
  if (s.kind === "MatchStmt") {
    checkExpr(s.scrutinee, sym, errors, ctx);
    // Arms are mutually exclusive — each starts fresh from the parent set.
    const armSets: Set<string>[] = [];
    for (const arm of s.arms) {
      const inner: Ctx = { ...ctx, localBinds: new Set(ctx.localBinds) };
      if (arm.pattern.kind === "PVariant")
        for (const b of arm.pattern.binds) if (b !== "_") inner.localBinds.add(b);
      if (arm.pattern.kind === "PBind") inner.localBinds.add(arm.pattern.name);
      const armWrites = new Set<string>(writtenRoots);
      for (const st of arm.body) checkStmt(st, sym, errors, inner, armWrites);
      armSets.push(armWrites);
    }
    for (const set of armSets) for (const r of set) writtenRoots.add(r);
    return;
  }
  if (s.kind === "NoopStmt") return;
  if (s.kind === "LetStmt") {
    checkExpr(s.rhs, sym, errors, ctx);
    ctx.localBinds.add(s.name);
    return;
  }
  if (s.kind === "Emit") {
    const eff = sym.effects.get(s.effect);
    const isBuiltinNav =
      s.effect === "navigate" ||
      s.effect === "navigate-replace" ||
      s.effect === "navigate-back" ||
      s.effect === "toast" ||
      s.effect === "log";
    if (!eff && !isBuiltinNav) {
      errors.push({
        code: "E0104",
        kind: "undef-effect",
        message: `Reference to undefined effect "${s.effect}"`,
        pos: s.pos,
      });
    } else if (eff && ctx.capsAvailable && !ctx.capsAvailable.has(eff.cap)) {
      errors.push({
        code: "E0301",
        kind: "missing-capability",
        message: `Effect "${s.effect}" requires capability "${eff.cap}" which is not declared in app.caps`,
        pos: s.pos,
      });
    }
    for (const a of s.args) checkExpr(a, sym, errors, ctx);
    return;
  }
  if (s.kind === "StopTimer") {
    if (!sym.timerNames.has(s.name)) {
      errors.push({
        code: "E0106",
        kind: "undef-timer",
        message: `stop-timer refers to undefined timer name "${s.name}"`,
        pos: s.pos,
      });
    }
    return;
  }
  // SlotAssign
  const root = lvalueRoot(s.lvalue);
  if (!sym.slots.has(root)) {
    errors.push({
      code: "E0103",
      kind: "undef-slot",
      message: `Assignment to undefined slot "${root}"`,
      pos: s.pos,
    });
  }
  // Track duplicate writes at lvalue-SHAPE granularity. `issues[iid].status`
  // and `issues[iid].updatedAt` have different shapes so they may coexist in
  // the same reducer; codegen accumulates them via `_setPath` chaining on the
  // shared `_next[root]`.
  const shape = lvalueShape(s.lvalue);
  if (writtenRoots.has(shape)) {
    errors.push({
      code: "E0601",
      kind: "duplicate-write",
      message: `Slot path "${shape}" is written more than once in this reducer`,
      pos: s.pos,
    });
  }
  writtenRoots.add(shape);
  checkLvalue(s.lvalue, sym, errors, ctx);
  checkExpr(s.rhs, sym, errors, ctx);
}

function lvalueShape(lv: Lvalue): string {
  if (lv.kind === "LSlot") return lv.name;
  const parts: string[] = [];
  let cur: Lvalue = lv;
  while (cur.kind !== "LSlot") {
    if (cur.kind === "LField") parts.unshift(`.${cur.field}`);
    else parts.unshift("[]");
    cur = cur.base;
  }
  return cur.name + parts.join("");
}

function lvalueRoot(lv: Lvalue): string {
  while (lv.kind !== "LSlot") {
    lv = lv.base;
  }
  return lv.name;
}

function checkLvalue(lv: Lvalue, sym: SymbolTable, errors: KumikiError[], ctx: Ctx): void {
  if (lv.kind === "LSlot") return;
  if (lv.kind === "LIndex") checkExpr(lv.index, sym, errors, ctx);
  checkLvalue(lv.base, sym, errors, ctx);
}

function checkExpr(e: Expr, sym: SymbolTable, errors: KumikiError[], ctx: Ctx): void {
  switch (e.kind) {
    case "Num":
    case "Str":
    case "Bool":
    case "Unit":
      return;
    case "Ref":
      if (ctx.localBinds.has(e.name)) return;
      if (sym.slots.has(e.name)) {
        if (ctx.kind === "fn") {
          errors.push({
            code: "E0305",
            kind: "fn-impurity",
            message: `fn "${currentFnName(ctx)}" must not read slot "${e.name}"`,
            pos: e.pos,
          });
        }
        return;
      }
      if (sym.fns.has(e.name)) return;
      // Could be a built-in like `route`
      if (e.name === "route" || e.name === "now" || e.name === "self") return;
      errors.push({
        code: "E0103",
        kind: "undef-ref",
        message: `Reference to undefined name "${e.name}"`,
        pos: e.pos,
      });
      return;
    case "Variant":
      for (const p of e.payload) checkExpr(p, sym, errors, ctx);
      return;
    case "BinOp":
      checkExpr(e.lhs, sym, errors, ctx);
      checkExpr(e.rhs, sym, errors, ctx);
      return;
    case "UnaryOp":
      checkExpr(e.rhs, sym, errors, ctx);
      return;
    case "FieldAccess":
      checkExpr(e.base, sym, errors, ctx);
      return;
    case "Index":
      checkExpr(e.base, sym, errors, ctx);
      checkExpr(e.index, sym, errors, ctx);
      return;
    case "Call":
      for (const a of e.args) checkExpr(a, sym, errors, ctx);
      return;
    case "MethodCall":
      if (!KNOWN_METHODS.has(e.method)) {
        errors.push({
          code: "E0801",
          kind: "unimplemented-method",
          message: `Method ".${e.method}" is not implemented by the runtime`,
          pos: e.pos,
        });
      }
      checkExpr(e.receiver, sym, errors, ctx);
      for (const a of e.args) {
        // Inside method call args, $1/$2 are implicit lambdas
        const inner: Ctx = { ...ctx, localBinds: new Set(ctx.localBinds) };
        inner.localBinds.add("$1");
        inner.localBinds.add("$2");
        checkExpr(a, sym, errors, inner);
      }
      return;
    case "RecordLit":
      for (const f of e.fields) checkExpr(f.value, sym, errors, ctx);
      return;
    case "ListLit":
      for (const it of e.items) checkExpr(it, sym, errors, ctx);
      return;
    case "MapLit":
      for (const ent of e.entries) {
        checkExpr(ent.key, sym, errors, ctx);
        checkExpr(ent.value, sym, errors, ctx);
      }
      return;
    case "MatchExpr": {
      checkExpr(e.scrutinee, sym, errors, ctx);
      for (const arm of e.arms) {
        const inner: Ctx = { ...ctx, localBinds: new Set(ctx.localBinds) };
        if (arm.pattern.kind === "PVariant")
          for (const b of arm.pattern.binds) if (b !== "_") inner.localBinds.add(b);
        if (arm.pattern.kind === "PBind") inner.localBinds.add(arm.pattern.name);
        checkExpr(arm.body, sym, errors, inner);
      }
      return;
    }
    case "IfExpr":
      checkExpr(e.cond, sym, errors, ctx);
      checkExpr(e.consequent, sym, errors, ctx);
      checkExpr(e.alternate, sym, errors, ctx);
      return;
    case "LetIn": {
      checkExpr(e.value, sym, errors, ctx);
      const inner: Ctx = { ...ctx, localBinds: new Set(ctx.localBinds) };
      inner.localBinds.add(e.name);
      checkExpr(e.body, sym, errors, inner);
      return;
    }
  }
}

function currentFnName(ctx: Ctx): string {
  return (ctx as Ctx & { fnName?: string }).fnName ?? "<fn>";
}

function checkFn(fn: FnDef, sym: SymbolTable, errors: KumikiError[]): void {
  const ctx: Ctx = { kind: "fn", localBinds: new Set() };
  (ctx as Ctx & { fnName?: string }).fnName = fn.name;
  for (const p of fn.params) ctx.localBinds.add(p.name);
  // also bind $1, $2 used in expression-fragment style
  ctx.localBinds.add("$1");
  ctx.localBinds.add("$2");
  checkExpr(fn.body, sym, errors, ctx);
}

function checkEffect(eff: EffectDef, sym: SymbolTable, errors: KumikiError[]): void {
  resolveType(eff.inType, sym, errors);
  resolveType(eff.outType, sym, errors);
  if (eff.mapRequest)
    checkExpr(eff.mapRequest, sym, errors, {
      kind: "slot-init", // treat as pure context (no slots, no fns)
      localBinds: new Set(["$1"]),
    });
}

function checkApp(app: AppDef, sym: SymbolTable, errors: KumikiError[]): void {
  let saw404 = false;
  for (const r of app.routes) {
    if (r.tile.startsWith(">>")) continue; // redirect
    if (!sym.tiles.has(r.tile)) {
      errors.push({
        code: "E0105",
        kind: "undef-tile",
        message: `Route "${r.path}" targets undefined tile "${r.tile}"`,
        pos: app.pos,
      });
    }
    if (r.path === "/404") saw404 = true;
  }
  if (!saw404) {
    errors.push({
      code: "E0001",
      kind: "missing-404",
      message: `app.routes must include a "/404" entry`,
      pos: app.pos,
    });
  }
  for (const e of app.init) {
    checkExpr(e, sym, errors, {
      kind: "reducer",
      localBinds: new Set(),
      capsAvailable: new Set(app.caps),
    });
  }
}

function resolveType(t: TypeExpr, sym: SymbolTable, errors: KumikiError[]): void {
  switch (t.kind) {
    case "TypePrim":
      return;
    case "TypeRef":
      if (!sym.types.has(t.name)) {
        // Could be an in-scope type param of an enclosing TypeDef; we don't track those yet.
        // Accept silently for Phase 2.
        return;
      }
      return;
    case "TypeApp":
      for (const a of t.args) resolveType(a, sym, errors);
      return;
    case "TypeRecord":
      for (const f of t.fields) resolveType(f.type, sym, errors);
      return;
    case "TypeUnion":
      for (const v of t.variants) for (const p of v.payloads) resolveType(p, sym, errors);
      return;
    case "TypeNominal":
      resolveType(t.inner, sym, errors);
      return;
    case "TypeRefinement":
      resolveType(t.inner, sym, errors);
      return;
  }
}
