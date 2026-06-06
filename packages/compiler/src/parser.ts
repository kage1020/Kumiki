import type {
  AppDef,
  BinOp,
  Def,
  EffectDef,
  EventPattern,
  Expr,
  FnDef,
  Lvalue,
  MatchArm,
  Pattern,
  PolicyExpr,
  Pos,
  Program,
  ReducerDef,
  Refinement,
  RetryExpr,
  SlotDef,
  Statement,
  TestDef,
  TileArg,
  TileDef,
  TileExpr,
  TileMatchArm,
  TileProp,
  Token,
  TypeDef,
  TypeExpr,
  UiEventKind,
} from "./ast.ts";

export class ParseError extends Error {
  constructor(
    message: string,
    public pos: Pos,
  ) {
    super(`Parse error at ${pos.line}:${pos.col}: ${message}`);
  }
}

const PRIM_TYPES = new Set(["Int", "Text", "Bool", "Unit", "Float", "Time", "Bytes"]);
const _GENERIC_TYPES = new Set(["Map", "Set", "List", "Option", "Result", "Tuple"]);
// Builtins whose positional argument is a value expression (Text/Number), not a tile.
const VALUE_ARG_BUILTINS = new Set([
  "text",
  "heading",
  "markdown",
  "label",
  "link",
  "image",
  "icon",
]);
// Named args whose value is always a value expression (Text / Number / etc.),
// independent of the enclosing builtin. This lets `button(text=if c then "A" else "B")`
// parse the `if` as a value-level `IfExpr` instead of a `TileIf`.
const VALUE_NAMED_ARGS = new Set([
  "text",
  "value",
  "placeholder",
  "to",
  "src",
  "id",
  "key",
  "name",
  "label",
  "title",
  "type",
  "color",
  "bg",
  "size",
  "weight",
  "variant",
  "pad",
  "gap",
  "align",
  "justify",
  "wrap",
  "w",
  "h",
  "min-w",
  "min-h",
  "max-w",
  "max-h",
  "radius",
  "shadow",
  "rows",
  "cols",
  "aspect",
]);
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
const REFINE_PREDS = new Set([
  "between",
  "nonempty",
  "len-eq",
  "len-lt",
  "len-gt",
  "positive",
  "negative",
  "email",
  "url",
  "uuid",
  "regex",
  "one-of",
]);

class Parser {
  private i = 0;
  constructor(private tokens: Token[]) {}

  // ----- low-level token utilities -----

  private peek(offset = 0): Token {
    return this.tokens[this.i + offset] ?? this.tokens[this.tokens.length - 1]!;
  }
  private next(): Token {
    return this.tokens[this.i++] ?? this.tokens[this.tokens.length - 1]!;
  }
  private eat<K extends Token["kind"]>(kind: K, value?: string): Extract<Token, { kind: K }> {
    const t = this.peek();
    if (t.kind !== kind || (value !== undefined && "value" in t && t.value !== value)) {
      const got = t.kind === "eof" ? "eof" : `${t.kind}(${t.value})`;
      const want = value !== undefined ? `${kind}(${value})` : kind;
      throw new ParseError(`Expected ${want}, got ${got}`, t.pos);
    }
    this.next();
    return t as Extract<Token, { kind: K }>;
  }
  private matchTAt(offset: number, kind: Token["kind"], value?: string): boolean {
    const t = this.peek(offset);
    if (t.kind !== kind) return false;
    if (value !== undefined && "value" in t && t.value !== value) return false;
    return true;
  }
  private matchT(kind: Token["kind"], value?: string): boolean {
    return this.matchTAt(0, kind, value);
  }
  private matchOp(value: string): boolean {
    return this.matchT("op", value);
  }
  private matchKw(value: string): boolean {
    return this.matchT("kw", value);
  }

  // ----- entry -----

  parseProgram(): Program {
    const defs: Def[] = [];
    while (!this.matchT("eof")) {
      if (this.matchT("ident", "theme")) {
        defs.push(this.parseThemeDef());
        continue;
      }
      if (this.matchT("ident", "motion")) {
        defs.push(this.parseMotionDef());
        continue;
      }
      defs.push(this.parseDef());
    }
    return { kind: "Program", defs };
  }

  private parseThemeDef(): Def {
    const start = this.eat("ident", "theme");
    const name = this.eat("ident").value;
    this.eat("op", "=");
    const body = this.parseThemeRecord();
    return { kind: "ThemeDef", name, body, pos: start.pos };
  }

  // `motion N = { keyframes: {...}, duration: ..., ... }`. The body reuses the
  // theme-record grammar (literals + nested records only), which is exactly why
  // a motion can't reference slots/effects — purity is structural (M5 AC4).
  private parseMotionDef(): Def {
    const start = this.eat("ident", "motion");
    const name = this.eat("ident").value;
    this.eat("op", "=");
    const body = this.parseThemeRecord();
    return { kind: "MotionDef", name, body, pos: start.pos };
  }

  private parseThemeRecord(): { [k: string]: import("./ast.ts").ThemeValue } {
    this.eat("op", "{");
    const out: { [k: string]: import("./ast.ts").ThemeValue } = {};
    if (!this.matchOp("}")) {
      this.parseThemeEntry(out);
      while (this.matchOp(",")) {
        this.next();
        if (this.matchOp("}")) break;
        this.parseThemeEntry(out);
      }
    }
    this.eat("op", "}");
    return out;
  }

  private parseThemeEntry(out: { [k: string]: import("./ast.ts").ThemeValue }): void {
    const keyTok = this.peek();
    if (keyTok.kind !== "ident" && keyTok.kind !== "kw" && keyTok.kind !== "str") {
      throw new ParseError(`Expected theme key`, keyTok.pos);
    }
    this.next();
    const key = keyTok.value as string;
    this.eat("op", ":");
    const v = this.peek();
    if (v.kind === "op" && v.value === "{") {
      out[key] = this.parseThemeRecord();
    } else if (v.kind === "str") {
      this.next();
      out[key] = v.value;
    } else if (v.kind === "num") {
      this.next();
      out[key] = v.value;
    } else {
      throw new ParseError(`Theme values must be string, number, or nested record`, v.pos);
    }
  }

  private parseDef(): Def {
    const t = this.peek();
    if (t.kind !== "kw") throw new ParseError("Expected a definition keyword", t.pos);
    switch (t.value) {
      case "type":
        return this.parseType();
      case "slot":
        return this.parseSlot();
      case "reducer":
        return this.parseReducer();
      case "tile":
        return this.parseTile();
      case "fn":
        return this.parseFn();
      case "effect":
        return this.parseEffect();
      case "app":
        return this.parseApp();
      case "test":
        return this.parseTest();
      default:
        throw new ParseError(`Unsupported definition keyword "${t.value}"`, t.pos);
    }
  }

  // ----- type defs -----

  private parseType(): TypeDef {
    const start = this.eat("kw", "type");
    const name = this.eat("ident").value;
    const params: string[] = [];
    if (this.matchOp("(")) {
      this.next();
      if (!this.matchOp(")")) {
        params.push(this.eat("ident").value);
        while (this.matchOp(",")) {
          this.next();
          params.push(this.eat("ident").value);
        }
      }
      this.eat("op", ")");
    }
    this.eat("op", "=");
    const body = this.parseTypeExpr();
    return { kind: "TypeDef", name, params, body, pos: start.pos };
  }

  private parseTypeExpr(): TypeExpr {
    // Union: parse first, then check for `|` follow-up
    const first = this.parseTypeUnionAtom();
    if (this.matchOp("|")) {
      const variants: { name: string; payloads: TypeExpr[] }[] = [this.typeAsVariant(first)];
      while (this.matchOp("|")) {
        this.next();
        variants.push(this.typeAsVariant(this.parseTypeUnionAtom()));
      }
      return { kind: "TypeUnion", variants, pos: first.pos };
    }
    // Refinement
    if (this.matchKw("where")) {
      this.next();
      const ref = this.parseRefinement();
      return { kind: "TypeRefinement", inner: first, refinement: ref, pos: first.pos };
    }
    return first;
  }

  private typeAsVariant(t: TypeExpr): { name: string; payloads: TypeExpr[] } {
    if (t.kind === "TypeRef") return { name: t.name, payloads: [] };
    if (t.kind === "TypeApp") return { name: t.name, payloads: t.args };
    throw new ParseError(`Unsupported variant form`, t.pos);
  }

  private parseTypeUnionAtom(): TypeExpr {
    // Handle: nominal, record, primitive, ref, generic
    if (this.matchKw("nominal")) {
      const start = this.next();
      const inner = this.parseTypeAtom();
      let refinement: Refinement | undefined;
      if (this.matchKw("where")) {
        this.next();
        refinement = this.parseRefinement();
      }
      const node: TypeExpr = { kind: "TypeNominal", inner, pos: start.pos };
      if (refinement) (node as { refinement?: Refinement }).refinement = refinement;
      return node;
    }
    const atom = this.parseTypeAtom();
    if (this.matchKw("where")) {
      this.next();
      const ref = this.parseRefinement();
      return { kind: "TypeRefinement", inner: atom, refinement: ref, pos: atom.pos };
    }
    return atom;
  }

  private parseTypeAtom(): TypeExpr {
    // Record: { fields }
    if (this.matchOp("{")) {
      const start = this.next();
      const fields: { name: string; type: TypeExpr }[] = [];
      if (!this.matchOp("}")) {
        fields.push(this.parseTypeField());
        while (this.matchOp(",")) {
          this.next();
          fields.push(this.parseTypeField());
        }
      }
      this.eat("op", "}");
      return { kind: "TypeRecord", fields, pos: start.pos };
    }
    // identifier or generic
    const t = this.eat("ident");
    const name = t.value;
    if (this.matchOp("(")) {
      // generic application
      this.next();
      const args: TypeExpr[] = [];
      if (!this.matchOp(")")) {
        args.push(this.parseTypeExpr());
        while (this.matchOp(",")) {
          this.next();
          args.push(this.parseTypeExpr());
        }
      }
      this.eat("op", ")");
      return { kind: "TypeApp", name, args, pos: t.pos };
    }
    if (PRIM_TYPES.has(name)) {
      return { kind: "TypePrim", name: name as "Int", pos: t.pos };
    }
    return { kind: "TypeRef", name, pos: t.pos };
  }

  private parseTypeField(): { name: string; type: TypeExpr } {
    const name = this.eat("ident").value;
    this.eat("op", ":");
    const type = this.parseTypeExpr();
    return { name, type };
  }

  private parseRefinement(): Refinement {
    const t = this.eat("ident");
    const name = t.value;
    if (!REFINE_PREDS.has(name)) {
      throw new ParseError(`Unknown refinement predicate "${name}"`, t.pos);
    }
    const args: (number | string)[] = [];
    if (this.matchOp("(")) {
      this.next();
      if (!this.matchOp(")")) {
        args.push(this.parseRefinementArg());
        while (this.matchOp(",")) {
          this.next();
          args.push(this.parseRefinementArg());
        }
      }
      this.eat("op", ")");
    }
    return { kind: "Refinement", pred: name, args, pos: t.pos };
  }

  private parseRefinementArg(): number | string {
    const t = this.peek();
    if (t.kind === "num") {
      this.next();
      return t.value;
    }
    if (t.kind === "str") {
      this.next();
      return t.value;
    }
    throw new ParseError("Refinement argument must be a literal", t.pos);
  }

  // ----- slot -----

  private parseSlot(): SlotDef {
    const start = this.eat("kw", "slot");
    const name = this.eat("ident").value;
    this.eat("op", ":");
    const type = this.parseTypeExpr();
    let modifier: SlotDef["modifier"];
    if (this.matchT("ident", "transient")) {
      this.next();
      modifier = "transient";
    } else if (this.matchT("ident", "volatile")) {
      this.next();
      modifier = "volatile";
    }
    this.eat("op", "=");
    const init = this.parseExpr();
    const def: SlotDef = { kind: "SlotDef", name, type, init, pos: start.pos };
    if (modifier) def.modifier = modifier;
    return def;
  }

  // ----- reducer -----

  private parseReducer(): ReducerDef {
    const start = this.eat("kw", "reducer");
    const name = this.eat("ident").value;
    this.eat("kw", "on");
    this.eat("op", "=");
    const on = this.parseEventPattern();
    this.eat("kw", "do");
    this.eat("op", "=");
    const stmts: Statement[] = [this.parseStatement()];
    while (this.matchOp(";") || this.statementLookahead()) {
      if (this.matchOp(";")) this.next();
      stmts.push(this.parseStatement());
    }
    return { kind: "ReducerDef", name, on, do: stmts, pos: start.pos };
  }

  // Detect when a new statement starts even without an explicit `;` (newline-friendly):
  // identifier followed by `:=`, `[`, `.`, or keyword `let`/`emit`.
  private statementLookahead(): boolean {
    if (
      this.matchKw("let") ||
      this.matchKw("emit") ||
      this.matchKw("for") ||
      this.matchKw("if") ||
      this.matchKw("match")
    ) {
      return true;
    }
    if (this.peek().kind === "ident") {
      // look further
      const j = this.i + 1;
      while (j < this.tokens.length) {
        const t = this.tokens[j]!;
        if (t.kind === "op" && (t.value === ":=" || t.value === "[" || t.value === "."))
          return true;
        if (t.kind === "op" && (t.value === ":=" || t.value === "(")) return true;
        if (t.kind === "kw") return false;
        if (t.kind === "ident") return false;
        if (t.kind === "eof") return false;
        // operators that continue an expression
        return false;
      }
    }
    return false;
  }

  private parseEventPattern(): EventPattern {
    const t = this.peek();
    // Special case: timer(<duration>) — a periodic lifecycle event
    if (t.kind === "ident" && t.value === "timer") {
      this.next();
      this.eat("op", "(");
      const intervalMs = this.parseDuration();
      let name: string | undefined;
      if (this.matchOp(",")) {
        this.next();
        const kw = this.eat("ident");
        if (kw.value !== "name") throw new ParseError(`Expected "name=" in timer(...)`, kw.pos);
        this.eat("op", "=");
        name = this.eat("ident").value;
      }
      this.eat("op", ")");
      return name === undefined
        ? { kind: "TimerEvent", intervalMs, pos: t.pos }
        : { kind: "TimerEvent", intervalMs, name, pos: t.pos };
    }
    // event patterns start with an identifier-like token: `ui`, `app`, `tile`, `route`, or an effect name
    if (t.kind === "ident" || (t.kind === "kw" && (t.value === "app" || t.value === "tile"))) {
      const name = t.value;
      this.next();
      this.eat("op", ".");
      const sub = this.eat("ident").value;
      if (name === "ui") {
        if (
          sub !== "click" &&
          sub !== "submit" &&
          sub !== "change" &&
          sub !== "input" &&
          sub !== "focus" &&
          sub !== "blur"
        ) {
          throw new ParseError(`Unknown ui event "${sub}"`, t.pos);
        }
        this.eat("op", "(");
        const tile = this.eat("ident").value;
        let id: string | undefined;
        if (this.matchOp("#")) {
          this.next();
          id = this.eat("ident").value;
        }
        this.eat("op", ")");
        const sel: { tile: string; id?: string } = { tile };
        if (id) sel.id = id;
        return { kind: "UiEvent", ev: sub as UiEventKind, selector: sel, pos: t.pos };
      }
      if (name === "app") {
        return { kind: "LifecycleEvent", name: `app.${sub}`, pos: t.pos };
      }
      if (name === "tile") {
        // tile.mount(X) — not parsed in Phase 2, but reserved
        if (this.matchOp("(")) {
          this.next();
          this.eat("ident");
          this.eat("op", ")");
        }
        return { kind: "LifecycleEvent", name: `tile.${sub}`, pos: t.pos };
      }
      if (name === "route") {
        // `route.enter("/p")` / `route.leave("/p")` carry the route pattern.
        // The pattern is part of the event identity: the runtime dispatches by
        // matching the reducer's name against `route.enter(${JSON.stringify(
        // matchedPattern)})`, so the literal must be preserved here (dropping it
        // would leave every route.enter/leave reducer dead). Encode it the same
        // way the runtime does so the names match verbatim.
        if (this.matchOp("(")) {
          this.next();
          const pattern = this.eat("str").value;
          this.eat("op", ")");
          return {
            kind: "LifecycleEvent",
            name: `route.${sub}(${JSON.stringify(pattern)})`,
            pos: t.pos,
          };
        }
        return { kind: "LifecycleEvent", name: `route.${sub}`, pos: t.pos };
      }
      // effect-name.ok / .err
      if (sub === "ok" || sub === "err") {
        this.eat("op", "(");
        const binds: string[] = [];
        if (!this.matchOp(")")) {
          binds.push(this.readBind());
          while (this.matchOp(",")) {
            this.next();
            binds.push(this.readBind());
          }
        }
        this.eat("op", ")");
        return {
          kind: "EffectEvent",
          effect: name,
          outcome: sub,
          binds,
          pos: t.pos,
        };
      }
      throw new ParseError(`Unsupported event pattern "${name}.${sub}"`, t.pos);
    }
    throw new ParseError("Expected event pattern", t.pos);
  }

  private readBind(): string {
    if (this.matchOp("_")) {
      this.next();
      return "_";
    }
    const t = this.peek();
    if (t.kind === "op" && t.value === "$") {
      // not actually used; binds in event are bare identifiers per spec
    }
    if (this.matchT("ident", "_")) {
      this.next();
      return "_";
    }
    const tok = this.eat("ident");
    return tok.value;
  }

  // ----- statements -----

  private parseStatement(): Statement {
    if (this.matchKw("for")) {
      const start = this.next();
      const bindTok = this.eat("ident");
      this.eat("kw", "in");
      const iter = this.parseExpr();
      const body = this.parseStatementBody();
      return { kind: "ForStmt", bind: bindTok.value, iter, body, pos: start.pos };
    }
    if (this.matchKw("if")) {
      const start = this.next();
      const cond = this.parseExpr();
      this.eat("kw", "then");
      const thenBody = this.parseStatementBody();
      let elseBody: Statement[] = [];
      if (this.matchKw("else")) {
        this.next();
        elseBody = this.parseStatementBody();
      }
      return { kind: "IfStmt", cond, consequent: thenBody, alternate: elseBody, pos: start.pos };
    }
    if (this.matchKw("match")) {
      const start = this.next();
      const scrutinee = this.parseExpr();
      this.eat("kw", "with");
      const arms: { pattern: Pattern; body: Statement[] }[] = [];
      while (this.matchOp("|")) {
        this.next();
        const pattern = this.parsePattern();
        this.eat("op", "->");
        const body = this.parseStatementBody();
        arms.push({ pattern, body });
      }
      return { kind: "MatchStmt", scrutinee, arms, pos: start.pos };
    }
    if (this.matchOp("(") && this.matchTAt(1, "op", ")")) {
      // `()` as a statement → noop
      const tok = this.next();
      this.eat("op", ")");
      return { kind: "NoopStmt", pos: tok.pos };
    }
    if (this.matchKw("let")) {
      const start = this.next();
      const name = this.eat("ident").value;
      this.eat("op", "=");
      const rhs = this.parseExpr();
      return { kind: "LetStmt", name, rhs, pos: start.pos };
    }
    if (this.matchKw("emit")) {
      const start = this.next();
      const effect = this.eat("ident").value;
      this.eat("op", "(");
      const args: Expr[] = [];
      if (!this.matchOp(")")) {
        args.push(this.parseExpr());
        while (this.matchOp(",")) {
          this.next();
          args.push(this.parseExpr());
        }
      }
      this.eat("op", ")");
      return { kind: "Emit", effect, args, pos: start.pos };
    }
    // `stop-timer(N)` — clear a named timer. `stop-timer` lexes as one ident.
    const cur = this.peek();
    if (cur.kind === "ident" && cur.value === "stop-timer") {
      this.next();
      this.eat("op", "(");
      const name = this.eat("ident").value;
      this.eat("op", ")");
      return { kind: "StopTimer", name, pos: cur.pos };
    }
    // SlotAssign with lvalue path
    const lvalue = this.parseLvalue();
    this.eat("op", ":=");
    const rhs = this.parseExpr();
    return { kind: "SlotAssign", lvalue, rhs, pos: lvalue.pos };
  }

  /**
   * Body of a control-flow statement (for / if-stmt / match-stmt arm).
   * Three accepted forms:
   *   - `{ stmt (; stmt)* }` explicit brace block
   *   - `stmt; stmt; ...` semicolon-separated (until next branch keyword)
   *   - `stmt\n stmt\n ...` newline-separated (until next branch keyword)
   * Stops at `else`, `}`, `|` (match arm), or EOF — those belong to the enclosing form.
   */
  private parseStatementBody(): Statement[] {
    if (this.matchOp("{")) {
      this.next();
      const out: Statement[] = [];
      if (!this.matchOp("}")) {
        out.push(this.parseStatement());
        while (this.matchOp(";") || (this.statementLookahead() && !this.matchOp("}"))) {
          if (this.matchOp(";")) this.next();
          if (this.matchOp("}")) break;
          out.push(this.parseStatement());
        }
      }
      this.eat("op", "}");
      return out;
    }
    const out: Statement[] = [this.parseStatement()];
    while (this.matchOp(";") || this.statementLookahead()) {
      if (this.matchOp(";")) this.next();
      // Stop at branch terminators that belong to the enclosing if / match / block.
      if (this.matchKw("else") || this.matchOp("}") || this.matchOp("|")) break;
      out.push(this.parseStatement());
    }
    return out;
  }

  private parseLvalue(): Lvalue {
    const tok = this.eat("ident");
    let lv: Lvalue = { kind: "LSlot", name: tok.value, pos: tok.pos };
    while (true) {
      if (this.matchOp(".")) {
        this.next();
        const f = this.eat("ident");
        lv = { kind: "LField", base: lv, field: f.value, pos: f.pos };
      } else if (this.matchOp("[")) {
        const t = this.next();
        const idx = this.parseExpr();
        this.eat("op", "]");
        lv = { kind: "LIndex", base: lv, index: idx, pos: t.pos };
      } else {
        break;
      }
    }
    return lv;
  }

  // ----- expressions -----

  parseExpr(): Expr {
    return this.parseLogicOr();
  }

  private parseLogicOr(): Expr {
    let lhs = this.parseLogicAnd();
    // `||` always works as bool OR. `|` also works as bool OR EXCEPT when it
    // clearly starts a match arm — i.e. it's immediately followed by a pattern
    // (capital-letter variant or `_`) and a `->`. This lets `a | b` mean bool
    // OR in expression context while still letting `not x | Done -> ...` be
    // parsed as a match arm separator.
    while (this.matchOp("||") || (this.matchOp("|") && !this.looksLikeMatchArm())) {
      const op = "|" as BinOp;
      this.next();
      const rhs = this.parseLogicAnd();
      lhs = { kind: "BinOp", op, lhs, rhs, pos: lhs.pos };
    }
    return lhs;
  }

  /** Heuristic: after `|`, does it look like the start of a match arm? */
  private looksLikeMatchArm(): boolean {
    const next = this.peek(1);
    // `| _ ->` is a wildcard match arm
    if (next.kind === "ident" && next.value === "_") return true;
    // `| Variant ->` or `| Variant(args) ->`
    if (next.kind === "ident" && next.value[0] && next.value[0] >= "A" && next.value[0] <= "Z") {
      // Look further: must eventually find `->` before another `|` or terminator.
      // Simple check: peek(2) must be `->` or `(`.
      const after = this.peek(2);
      if (after.kind === "op" && (after.value === "->" || after.value === "(")) return true;
    }
    return false;
  }
  private parseLogicAnd(): Expr {
    let lhs = this.parseCmp();
    // `&&` and `&` are both accepted as boolean AND — `&` is a tolerance alias
    // for LLMs that bring C-style habits. (`|` would conflict with type union
    // and match arm separator; only `&` can be safely aliased.)
    while (this.matchOp("&&") || this.matchOp("&")) {
      this.next();
      const rhs = this.parseCmp();
      lhs = { kind: "BinOp", op: "&", lhs, rhs, pos: lhs.pos };
    }
    return lhs;
  }
  private parseCmp(): Expr {
    let lhs = this.parseAdd();
    while (this.matchAnyOp(["==", "!=", "<", ">", "<=", ">="])) {
      const op = this.eat("op").value as BinOp;
      const rhs = this.parseAdd();
      lhs = { kind: "BinOp", op, lhs, rhs, pos: lhs.pos };
    }
    return lhs;
  }
  private parseAdd(): Expr {
    let lhs = this.parseMul();
    while (this.matchAnyOp(["+", "-"])) {
      const op = this.eat("op").value as BinOp;
      const rhs = this.parseMul();
      lhs = { kind: "BinOp", op, lhs, rhs, pos: lhs.pos };
    }
    return lhs;
  }
  private parseMul(): Expr {
    let lhs = this.parseUnary();
    while (this.matchAnyOp(["*", "/", "%"])) {
      const op = this.eat("op").value as BinOp;
      const rhs = this.parseUnary();
      lhs = { kind: "BinOp", op, lhs, rhs, pos: lhs.pos };
    }
    return lhs;
  }
  private parseUnary(): Expr {
    if (this.matchOp("-")) {
      const tok = this.next();
      const rhs = this.parseUnary();
      return { kind: "UnaryOp", op: "-", rhs, pos: tok.pos };
    }
    if (this.matchOp("!")) {
      const tok = this.next();
      const rhs = this.parseUnary();
      return { kind: "UnaryOp", op: "!", rhs, pos: tok.pos };
    }
    // `not` as keyword equivalent of `!`
    if (this.matchT("ident", "not")) {
      const tok = this.next();
      const rhs = this.parseUnary();
      return { kind: "UnaryOp", op: "!", rhs, pos: tok.pos };
    }
    return this.parsePostfix();
  }

  private parsePostfix(): Expr {
    let e = this.parsePrimary();
    while (true) {
      if (this.matchOp(".")) {
        this.next();
        const fldTok = this.peek();
        if (fldTok.kind !== "ident" && fldTok.kind !== "kw") {
          throw new ParseError(`Expected field or method name`, fldTok.pos);
        }
        this.next();
        const fld = fldTok.value;
        if (this.matchOp("(")) {
          // method call
          this.next();
          const args: Expr[] = [];
          // `.copy(field=value, ...)` is a record-update syntax: the named
          // args are collected into a single RecordLit and the method call
          // proceeds with one arg. (See docs/spec/language.md §1.6 lvalue path.)
          const isCopyKwargs =
            fld === "copy" &&
            this.matchT("ident") &&
            this.matchTAt(1, "op", "=") &&
            // Not `==` (comparison) — peek further
            !this.matchTAt(2, "op", "=");
          if (isCopyKwargs) {
            const fields: { kind: "RecordField"; name: string; value: Expr; pos: Pos }[] = [];
            const firstPos = this.peek().pos;
            const readKwarg = (): void => {
              const nameTok = this.eat("ident");
              this.eat("op", "=");
              const value = this.parseExpr();
              fields.push({ kind: "RecordField", name: nameTok.value, value, pos: nameTok.pos });
            };
            readKwarg();
            while (this.matchOp(",")) {
              this.next();
              readKwarg();
            }
            args.push({ kind: "RecordLit", fields, pos: firstPos } as Expr);
          } else if (!this.matchOp(")")) {
            args.push(this.parseExpr());
            while (this.matchOp(",")) {
              this.next();
              args.push(this.parseExpr());
            }
          }
          this.eat("op", ")");
          e = { kind: "MethodCall", receiver: e, method: fld, args, pos: e.pos };
        } else {
          e = { kind: "FieldAccess", base: e, field: fld, pos: e.pos };
        }
      } else if (this.matchOp("[")) {
        this.next();
        const idx = this.parseExpr();
        this.eat("op", "]");
        e = { kind: "Index", base: e, index: idx, pos: e.pos };
      } else {
        break;
      }
    }
    return e;
  }

  private parsePrimary(): Expr {
    const t = this.peek();
    if (t.kind === "num") {
      this.next();
      return { kind: "Num", value: t.value, pos: t.pos };
    }
    if (t.kind === "str") {
      this.next();
      return { kind: "Str", value: t.value, pos: t.pos };
    }
    if (t.kind === "kw" && (t.value === "true" || t.value === "false")) {
      this.next();
      return { kind: "Bool", value: t.value === "true", pos: t.pos };
    }
    if (t.kind === "kw" && t.value === "now") {
      this.next();
      return { kind: "Call", callee: "now", args: [], pos: t.pos };
    }
    if (t.kind === "kw" && t.value === "if") {
      return this.parseIfExpr();
    }
    if (t.kind === "kw" && t.value === "let") {
      return this.parseLetIn();
    }
    if (t.kind === "kw" && t.value === "match") {
      return this.parseMatchExpr();
    }
    if (t.kind === "op" && t.value === "(") {
      this.next();
      const inner = this.parseExpr();
      this.eat("op", ")");
      return inner;
    }
    if (t.kind === "op" && t.value === "{") {
      return this.parseRecordOrMapLit();
    }
    if (t.kind === "op" && t.value === "[") {
      return this.parseListLit();
    }
    if (t.kind === "ident") {
      this.next();
      const name = t.value;
      // qualified call (Module.fn / TypeName.method) — only when the receiver is a
      // capital-cased identifier; otherwise this is a method call on a value and
      // should be parsed by parsePostfix.
      const isQualifierReceiver = !!name[0] && name[0]! >= "A" && name[0]! <= "Z";
      if (
        isQualifierReceiver &&
        this.matchOp(".") &&
        (this.matchTAt(1, "ident") || this.matchTAt(1, "kw")) &&
        this.matchTAt(2, "op", "(")
      ) {
        this.next(); // .
        const subTok = this.next();
        const sub = "value" in subTok ? String(subTok.value) : "";
        this.eat("op", "(");
        const args: Expr[] = [];
        if (!this.matchOp(")")) {
          args.push(this.parseExpr());
          while (this.matchOp(",")) {
            this.next();
            args.push(this.parseExpr());
          }
        }
        this.eat("op", ")");
        return { kind: "Call", callee: `${name}.${sub}`, args, pos: t.pos };
      }
      // direct call
      if (this.matchOp("(")) {
        this.next();
        const args: Expr[] = [];
        if (!this.matchOp(")")) {
          args.push(this.parseExpr());
          while (this.matchOp(",")) {
            this.next();
            args.push(this.parseExpr());
          }
        }
        this.eat("op", ")");
        // variant constructor heuristic: identifier with capital first letter
        if (name[0] && name[0] >= "A" && name[0] <= "Z") {
          return { kind: "Variant", name, payload: args, pos: t.pos };
        }
        return { kind: "Call", callee: name, args, pos: t.pos };
      }
      // bare identifier — could be ref OR variant (no payload)
      if (name[0] && name[0] >= "A" && name[0] <= "Z") {
        return { kind: "Variant", name, payload: [], pos: t.pos };
      }
      return { kind: "Ref", name, pos: t.pos };
    }
    if (t.kind === "op" && (t.value === "$1" || t.value === "$2")) {
      // never lexed as op since `$` is not in our op set; handled separately
    }
    throw new ParseError(`Unexpected token in expression`, t.pos);
  }

  private parseIfExpr(): Expr {
    const start = this.eat("kw", "if");
    const cond = this.parseExpr();
    this.eat("kw", "then");
    const thenE = this.parseExpr();
    this.eat("kw", "else");
    const elseE = this.parseExpr();
    return { kind: "IfExpr", cond, consequent: thenE, alternate: elseE, pos: start.pos };
  }

  private parseLetIn(): Expr {
    const start = this.eat("kw", "let");
    const name = this.eat("ident").value;
    this.eat("op", "=");
    const value = this.parseExpr();
    this.eat("kw", "in");
    const body = this.parseExpr();
    return { kind: "LetIn", name, value, body, pos: start.pos };
  }

  private parseMatchExpr(): Expr {
    const start = this.eat("kw", "match");
    const scrutinee = this.parseExpr();
    this.eat("kw", "with");
    const arms: MatchArm[] = [];
    while (this.matchOp("|")) {
      this.next();
      const pattern = this.parsePattern();
      this.eat("op", "->");
      const body = this.parseExpr();
      arms.push({ pattern, body });
    }
    if (arms.length === 0) throw new ParseError("match requires at least one arm", start.pos);
    return { kind: "MatchExpr", scrutinee, arms, pos: start.pos };
  }

  private parsePattern(): Pattern {
    const t = this.peek();
    if (t.kind === "ident" && t.value === "_") {
      this.next();
      return { kind: "PWildcard", pos: t.pos };
    }
    if (t.kind === "ident") {
      const name = t.value;
      this.next();
      if (this.matchOp("(")) {
        this.next();
        const binds: string[] = [];
        if (!this.matchOp(")")) {
          binds.push(this.parsePatternBind());
          while (this.matchOp(",")) {
            this.next();
            binds.push(this.parsePatternBind());
          }
        }
        this.eat("op", ")");
        return { kind: "PVariant", name, binds, pos: t.pos };
      }
      // bare ident: capital → variant w/o payload, lowercase → bind
      if (name[0] && name[0] >= "A" && name[0] <= "Z") {
        return { kind: "PVariant", name, binds: [], pos: t.pos };
      }
      return { kind: "PBind", name, pos: t.pos };
    }
    if (t.kind === "num") {
      this.next();
      return { kind: "PLiteral", value: t.value, pos: t.pos };
    }
    if (t.kind === "str") {
      this.next();
      return { kind: "PLiteral", value: t.value, pos: t.pos };
    }
    throw new ParseError("Expected pattern", t.pos);
  }

  private parsePatternBind(): string {
    const t = this.peek();
    if (t.kind === "ident") {
      this.next();
      return t.value;
    }
    throw new ParseError("Expected pattern bind", t.pos);
  }

  private parseRecordOrMapLit(): Expr {
    const start = this.eat("op", "{");
    // Empty {} → MapLit (no entries)
    if (this.matchOp("}")) {
      this.next();
      return { kind: "MapLit", entries: [], pos: start.pos };
    }
    // Heuristic: if the first key is a field name (identifier or keyword, e.g.
    // `type` / `in`) followed by `=`, `:`, `,`, or `}`, treat the whole literal
    // as a record. Otherwise it's a map. A bare keyword key is never a valid map
    // key, so this stays unambiguous.
    let isRecord = false;
    const k0 = this.peek();
    if (k0.kind === "ident" || k0.kind === "kw") {
      const peek1 = this.peek(1);
      if (
        peek1.kind === "op" &&
        (peek1.value === "=" || peek1.value === ":" || peek1.value === "," || peek1.value === "}")
      ) {
        isRecord = true;
      }
    }
    if (isRecord) {
      const fields: { name: string; value: Expr }[] = [];
      while (true) {
        const keyTok = this.peek();
        if (keyTok.kind !== "ident" && keyTok.kind !== "kw") {
          throw new ParseError("Expected a record field name", keyTok.pos);
        }
        const fieldName = keyTok.value;
        const fieldPos = keyTok.pos;
        this.next();
        let value: Expr;
        if (this.matchOp("=") || this.matchOp(":")) {
          this.next();
          value = this.parseExpr();
        } else {
          value = { kind: "Ref", name: fieldName, pos: fieldPos };
        }
        fields.push({ name: fieldName, value });
        if (!this.matchOp(",")) break;
        this.next();
      }
      this.eat("op", "}");
      return { kind: "RecordLit", fields, pos: start.pos };
    }
    // Map literal
    const entries: { key: Expr; value: Expr }[] = [];
    entries.push(this.parseMapEntry());
    while (this.matchOp(",")) {
      this.next();
      entries.push(this.parseMapEntry());
    }
    this.eat("op", "}");
    return { kind: "MapLit", entries, pos: start.pos };
  }

  private parseMapEntry(): { key: Expr; value: Expr } {
    const key = this.parseExpr();
    this.eat("op", ":");
    const value = this.parseExpr();
    return { key, value };
  }

  private parseListLit(): Expr {
    const start = this.eat("op", "[");
    const items: Expr[] = [];
    if (!this.matchOp("]")) {
      items.push(this.parseExpr());
      while (this.matchOp(",")) {
        this.next();
        items.push(this.parseExpr());
      }
    }
    this.eat("op", "]");
    return { kind: "ListLit", items, pos: start.pos };
  }

  private matchAnyOp(ops: string[]): boolean {
    const t = this.peek();
    return t.kind === "op" && ops.includes(t.value);
  }

  // ----- tile -----

  private parseTile(): TileDef {
    const start = this.eat("kw", "tile");
    const name = this.eat("ident").value;
    let inType: TypeExpr | undefined;
    let errorBoundary: string | undefined;
    while (!this.matchOp("=")) {
      if (this.matchKw("in")) {
        this.next();
        this.eat("op", "=");
        inType = this.parseTypeExpr();
        continue;
      }
      if (this.matchT("ident", "error-boundary")) {
        this.next();
        this.eat("op", "=");
        errorBoundary = this.eat("ident").value;
        continue;
      }
      if (this.matchT("ident", "scroll-restoration")) {
        this.next();
        this.eat("op", "=");
        // accept boolean
        const t = this.peek();
        if (t.kind === "kw" && (t.value === "true" || t.value === "false")) this.next();
        else this.parseExpr();
        continue;
      }
      if (this.matchT("ident", "sub-routes")) {
        this.next();
        this.eat("op", "=");
        // accept and discard a route-map literal
        this.parseRouteMap();
        continue;
      }
      const t = this.peek();
      throw new ParseError(`Unexpected token in tile definition`, t.pos);
    }
    this.eat("op", "=");
    const body = this.parseTileExpr();
    const def: TileDef = { kind: "TileDef", name, body, pos: start.pos };
    if (inType) def.in = inType;
    if (errorBoundary) def.errorBoundary = errorBoundary;
    return def;
  }

  private parseTileExpr(): TileExpr {
    // for/when/if/match control
    if (this.matchKw("for")) {
      const start = this.next();
      const bindTok = this.eat("ident");
      this.eat("kw", "in");
      const iter = this.parseExpr();
      const body = this.parseTileExpr();
      return { kind: "TileFor", bind: bindTok.value, iter, body, pos: start.pos };
    }
    if (this.matchKw("when")) {
      const start = this.next();
      this.eat("op", "(");
      const cond = this.parseExpr();
      this.eat("op", ",");
      const body = this.parseTileExpr();
      this.eat("op", ")");
      return { kind: "TileWhen", cond, body, pos: start.pos };
    }
    if (this.matchKw("if")) {
      const start = this.next();
      const cond = this.parseExpr();
      this.eat("kw", "then");
      const thenT = this.parseTileExpr();
      this.eat("kw", "else");
      const elseT = this.parseTileExpr();
      return { kind: "TileIf", cond, consequent: thenT, alternate: elseT, pos: start.pos };
    }
    if (this.matchKw("match")) {
      const start = this.next();
      const scrut = this.parseExpr();
      this.eat("kw", "with");
      const arms: TileMatchArm[] = [];
      while (this.matchOp("|")) {
        this.next();
        const pattern = this.parsePattern();
        this.eat("op", "->");
        const body = this.parseTileExpr();
        arms.push({ pattern, body });
      }
      return { kind: "TileMatch", scrutinee: scrut, arms, pos: start.pos };
    }
    return this.parseTileCall();
  }

  private parseTileCall(): TileExpr {
    const nameTok = this.eat("ident");
    const name = nameTok.value;
    const isBuiltin = BUILTIN_TILES.has(name);
    // value-arg builtins take a text/number expression as their positional arg,
    // not a tile. `match` inside them is a value match (`MatchExpr`), not a
    // tile match (`TileMatch`).
    const takesValueArg = VALUE_ARG_BUILTINS.has(name);
    const args: TileArg[] = [];
    if (this.matchOp("(")) {
      this.next();
      if (!this.matchOp(")")) {
        args.push(this.parseTileArg(isBuiltin, takesValueArg));
        while (this.matchOp(",")) {
          this.next();
          args.push(this.parseTileArg(isBuiltin, takesValueArg));
        }
      }
      this.eat("op", ")");
    }
    const props: TileProp[] = [];
    if (this.matchOp("{")) {
      this.next();
      if (!this.matchOp("}")) {
        props.push(this.parseTileProp());
        while (this.matchOp(",")) {
          this.next();
          props.push(this.parseTileProp());
        }
      }
      this.eat("op", "}");
    }
    return { kind: "TileCall", name, args, props, pos: nameTok.pos };
  }

  private parseTileArg(parentIsBuiltin: boolean, parentTakesValueArg = false): TileArg {
    // named arg: (ident|kw) = (expr | tile)
    const first = this.peek();
    if ((first.kind === "ident" || first.kind === "kw") && this.matchTAt(1, "op", "=")) {
      const name = first.value;
      this.next();
      this.eat("op", "=");
      // Named args with a well-known value-typed name (text/value/placeholder
      // /to/src/id/key/...) are always parsed in value context, regardless of
      // whether the parent tile is itself a value-arg builtin.
      const argTakesValue = parentTakesValueArg || VALUE_NAMED_ARGS.has(name);
      const value = this.parseArgValue(parentIsBuiltin, argTakesValue);
      return { kind: "TileArg", name, value };
    }
    return { kind: "TileArg", value: this.parseArgValue(parentIsBuiltin, parentTakesValueArg) };
  }

  private parseArgValue(parentIsBuiltin = true, parentTakesValueArg = false): Expr | TileExpr {
    if (this.matchKw("for") || this.matchKw("when")) {
      return this.parseTileExpr();
    }
    if (this.matchKw("match")) {
      // value-arg builtins (text / heading / markdown / label / link) take an
      // expression positional arg, so a `match` inside them is a value match.
      // Other tile-arg builtins (column / row / card / page / ...) take tiles,
      // so `match` produces a `TileMatch`.
      if (parentTakesValueArg) return this.parseExpr();
      return this.parseTileExpr();
    }
    if (this.matchKw("if")) {
      // Same dispatch as `match`: value-arg builtins take an expression-level if,
      // tile-arg builtins take a tile-level if.
      if (parentTakesValueArg) return this.parseExpr();
      return this.parseTileExpr();
    }
    const tok0 = this.peek();
    if (tok0.kind === "ident") {
      // Value-arg builtins (heading/text/markdown/label/link/image/icon) take a
      // value expression, never a nested tile. An identifier here is always a
      // value — even one that shadows a builtin tile name (e.g. a user
      // `fn label`) or is capital-cased — so parse it as an expression. Without
      // this guard `heading(label(x))` mis-parses `label(x)` as a builtin tile.
      if (parentTakesValueArg) return this.parseExpr();
      const name = tok0.value;
      const p1 = this.peek(1);
      const looksLikeTileCall = p1.kind === "op" && (p1.value === "(" || p1.value === "{");
      const isBuiltin = BUILTIN_TILES.has(name);
      const isCapital = !!name[0] && name[0]! >= "A" && name[0]! <= "Z";
      // builtins are always treated as tile calls.
      if (isBuiltin && looksLikeTileCall) return this.parseTileCall();
      // Inside a user tile call, positional args lean towards expressions
      // (so `FilterTab(All)` reads `All` as a variant payload, not a tile reference).
      if (!parentIsBuiltin) return this.parseExpr();
      // Inside a builtin tile, capital-cased identifiers refer to user tiles.
      if (isCapital && looksLikeTileCall) return this.parseTileCall();
      if (isCapital && !looksLikeTileCall) return this.parseTileCall();
    }
    return this.parseExpr();
  }

  private parseTileProp(): TileProp {
    const nameTok = this.peek();
    if (nameTok.kind !== "ident" && nameTok.kind !== "kw") {
      throw new ParseError("Expected prop name", nameTok.pos);
    }
    this.next();
    this.eat("op", ":");
    const value = this.parseExpr();
    return { kind: "TileProp", name: nameTok.value as string, value };
  }

  // ----- fn -----

  private parseFn(): FnDef {
    const start = this.eat("kw", "fn");
    const name = this.eat("ident").value;
    this.eat("op", "(");
    const params: { name: string; type: TypeExpr }[] = [];
    if (!this.matchOp(")")) {
      params.push(this.parseFnParam());
      while (this.matchOp(",")) {
        this.next();
        params.push(this.parseFnParam());
      }
    }
    this.eat("op", ")");
    let ret: TypeExpr | undefined;
    if (this.matchOp("->")) {
      this.next();
      ret = this.parseTypeExpr();
    }
    this.eat("op", "=");
    const body = this.parseExpr();
    const def: FnDef = { kind: "FnDef", name, params, body, pos: start.pos };
    if (ret) (def as FnDef & { ret?: TypeExpr }).ret = ret;
    return def;
  }

  private parseFnParam(): { name: string; type: TypeExpr } {
    const name = this.eat("ident").value;
    this.eat("op", ":");
    const type = this.parseTypeExpr();
    return { name, type };
  }

  // ----- effect -----

  private parseEffect(): EffectDef {
    const start = this.eat("kw", "effect");
    const name = this.eat("ident").value;
    let cap: string | undefined;
    let inType: TypeExpr | undefined;
    let outType: TypeExpr | undefined;
    let policy: PolicyExpr | undefined;
    let retry: RetryExpr | undefined;
    let mapRequest: Expr | undefined;

    while (this.isEffectField()) {
      const key = this.peek();
      if (key.kind === "kw" && key.value === "cap") {
        this.next();
        this.eat("op", "=");
        cap = this.readQualifiedName();
      } else if (key.kind === "kw" && key.value === "in") {
        this.next();
        this.eat("op", "=");
        inType = this.parseTypeExpr();
      } else if (key.kind === "kw" && key.value === "out") {
        this.next();
        this.eat("op", "=");
        outType = this.parseTypeExpr();
      } else if (key.kind === "kw" && key.value === "policy") {
        this.next();
        this.eat("op", "=");
        policy = this.parsePolicy();
      } else if (key.kind === "kw" && key.value === "retry") {
        this.next();
        this.eat("op", "=");
        retry = this.parseRetry();
      } else if (key.kind === "ident" && key.value === "map-request") {
        this.next();
        this.eat("op", "=");
        mapRequest = this.parseExpr();
      } else {
        break;
      }
    }

    if (!cap || !inType || !outType) {
      throw new ParseError(`effect requires cap, in, out`, start.pos);
    }
    const def: EffectDef = {
      kind: "EffectDef",
      name,
      cap,
      inType,
      outType,
      pos: start.pos,
    };
    if (policy) def.policy = policy;
    if (retry) def.retry = retry;
    if (mapRequest) def.mapRequest = mapRequest;
    return def;
  }

  private isEffectField(): boolean {
    const t = this.peek();
    if (t.kind === "kw" && ["cap", "in", "out", "policy", "retry"].includes(t.value)) {
      return true;
    }
    if (t.kind === "ident" && t.value === "map-request") return true;
    return false;
  }

  private parsePolicy(): PolicyExpr {
    const t = this.eat("ident");
    if (t.value === "latest") return { kind: "PolLatest" };
    if (t.value === "queue") return { kind: "PolQueue" };
    if (t.value === "once") return { kind: "PolOnce" };
    if (t.value === "latest-per-key") {
      this.eat("op", "(");
      const key = this.parseExpr();
      this.eat("op", ")");
      return { kind: "PolLatestKey", key };
    }
    if (t.value === "debounce") {
      this.eat("op", "(");
      const ms = this.parseDuration();
      this.eat("op", ")");
      return { kind: "PolDebounce", ms };
    }
    if (t.value === "throttle") {
      this.eat("op", "(");
      const ms = this.parseDuration();
      this.eat("op", ")");
      return { kind: "PolThrottle", ms };
    }
    throw new ParseError(`Unknown policy "${t.value}"`, t.pos);
  }

  private parseRetry(): RetryExpr {
    const t = this.eat("ident");
    if (t.value === "none") return { kind: "RetryNone" };
    if (t.value === "linear") {
      this.eat("op", "(");
      const n = this.eat("num").value;
      this.eat("op", ",");
      const ms = this.parseDuration();
      this.eat("op", ")");
      return { kind: "RetryLinear", n, ms };
    }
    if (t.value === "exponential") {
      this.eat("op", "(");
      const n = this.eat("num").value;
      this.eat("op", ",");
      const ms = this.parseDuration();
      this.eat("op", ",");
      const factor = this.eat("num").value;
      this.eat("op", ")");
      return { kind: "RetryExp", n, ms, factor };
    }
    throw new ParseError(`Unknown retry "${t.value}"`, t.pos);
  }

  private parseDuration(): number {
    const n = this.eat("num").value;
    const unit = this.eat("ident").value;
    if (unit === "ms") return n;
    if (unit === "s") return n * 1000;
    if (unit === "m") return n * 60 * 1000;
    throw new ParseError(`Unknown duration unit "${unit}"`, this.peek().pos);
  }

  // ----- app -----

  private parseApp(): AppDef {
    const start = this.eat("kw", "app");
    const name = this.eat("ident").value;
    let caps: string[] = [];
    let routes: { path: string; tile: string }[] = [];
    let init: Expr[] = [];
    let theme: string | undefined;

    while (!this.isAppEnd()) {
      const ident = this.eat("ident");
      const k = ident.value;
      this.eat("op", "=");
      if (k === "caps") caps = this.parseQualifiedList();
      else if (k === "routes") routes = this.parseRouteMap();
      else if (k === "init") init = this.parseInitList();
      else if (k === "theme") theme = this.eat("ident").value;
      else if (k === "meta" || k === "http" || k === "indexed-db" || k === "analytics") {
        // skip the value (Phase 2: parse record literal but ignore)
        this.parseExpr();
      } else {
        throw new ParseError(`Unknown app field "${k}"`, ident.pos);
      }
    }

    const def: AppDef = { kind: "AppDef", name, caps, routes, init, pos: start.pos };
    if (theme) def.theme = theme;
    return def;
  }

  private isAppEnd(): boolean {
    const t = this.peek();
    if (t.kind === "eof") return true;
    if (t.kind === "kw") return true;
    return false;
  }

  // ----- test -----

  private parseTest(): TestDef {
    const start = this.eat("kw", "test");
    const name = this.eat("ident").value;
    this.eat("op", "=");
    const kindTok = this.eat("ident");
    if (kindTok.value !== "reducer-test" && kindTok.value !== "tile-test") {
      throw new ParseError(
        `Unknown test kind "${kindTok.value}" (expected reducer-test or tile-test)`,
        kindTok.pos,
      );
    }
    const target = this.eat("ident").value;

    const givenKw = this.eat("ident");
    if (givenKw.value !== "given") {
      throw new ParseError(`Expected "given" in test "${name}"`, givenKw.pos);
    }
    this.eat("op", "=");
    const given = this.parseExpr();

    const expectKw = this.eat("ident");
    if (expectKw.value !== "expect") {
      throw new ParseError(`Expected "expect" in test "${name}"`, expectKw.pos);
    }
    this.eat("op", "=");
    const expect = kindTok.value === "tile-test" ? this.parseTileExpr() : this.parseExpr();

    return {
      kind: "TestDef",
      name,
      testKind: kindTok.value,
      target,
      given,
      expect,
      pos: start.pos,
    };
  }

  private parseQualifiedList(): string[] {
    this.eat("op", "[");
    const out: string[] = [];
    if (!this.matchOp("]")) {
      out.push(this.readQualifiedName());
      while (this.matchOp(",")) {
        this.next();
        out.push(this.readQualifiedName());
      }
    }
    this.eat("op", "]");
    return out;
  }

  private readQualifiedName(): string {
    let name = this.eat("ident").value;
    while (this.matchOp(".")) {
      this.next();
      name += `.${this.eat("ident").value}`;
    }
    return name;
  }

  private parseRouteMap(): { path: string; tile: string }[] {
    this.eat("op", "{");
    const routes: { path: string; tile: string }[] = [];
    if (!this.matchOp("}")) {
      routes.push(this.parseRouteEntry());
      while (this.matchOp(",")) {
        this.next();
        routes.push(this.parseRouteEntry());
      }
    }
    this.eat("op", "}");
    return routes;
  }

  private parseRouteEntry(): { path: string; tile: string } {
    const path = this.eat("str").value;
    if (this.matchOp("->>")) {
      this.next();
      // redirect target as string. Represent it as a tile name; not actually used in Phase 2.
      const target = this.eat("str").value;
      return { path, tile: `>>${target}` };
    }
    this.eat("op", "->");
    const tile = this.eat("ident").value;
    return { path, tile };
  }

  private parseInitList(): Expr[] {
    this.eat("op", "[");
    const out: Expr[] = [];
    if (!this.matchOp("]")) {
      out.push(this.parseExpr());
      while (this.matchOp(",")) {
        this.next();
        out.push(this.parseExpr());
      }
    }
    this.eat("op", "]");
    return out;
  }
}

export function parse(tokens: Token[]): Program {
  return new Parser(tokens).parseProgram();
}
