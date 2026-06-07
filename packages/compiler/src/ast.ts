// AST types for Kumiki v0.1 — Phase 1 + Phase 2 (TodoMVC).

export type Pos = { line: number; col: number };

export type Token =
  | { kind: "ident"; value: string; pos: Pos }
  | { kind: "kw"; value: string; pos: Pos }
  | { kind: "num"; value: number; pos: Pos }
  | { kind: "str"; value: string; pos: Pos }
  | { kind: "op"; value: string; pos: Pos }
  | { kind: "eof"; pos: Pos };

export type Program = {
  kind: "Program";
  defs: Def[];
};

export type Def =
  | TypeDef
  | SlotDef
  | ReducerDef
  | TileDef
  | FnDef
  | EffectDef
  | AppDef
  | ThemeDef
  | MotionDef
  | TestDef;

// ----- test layer (in-language tests; excluded from the production build) -----

export type TestDef = {
  kind: "TestDef";
  name: string;
  /** `reducer-test` targets a reducer; `tile-test` a tile; `property-test` has no target. */
  testKind: "reducer-test" | "tile-test" | "property-test";
  /** Reducer / tile name. Absent for `property-test`. */
  target?: string;
  /** The `given = { ... }` record literal (interpreted, not codegen'd as-is). */
  given: Expr;
  /** `expect = { slots, effects }` / `{ panic }` (record) for reducer-test; a tile expression for tile-test. Absent for `property-test`. */
  expect?: Expr | TileExpr;
  /** `property-test` only: the `for-all = { name: Type }` generators. */
  forAll?: { name: string; type: TypeExpr }[];
  /** `property-test` only: the boolean `invariant` expression checked per case. */
  invariant?: Expr;
  /** `property-test` only: trial count (default 100). */
  count?: number;
  /** `property-test` only: shrink on failure (default true). */
  shrink?: boolean;
  pos: Pos;
};

export type ThemeValue = string | number | { [k: string]: ThemeValue };

export type ThemeDef = {
  kind: "ThemeDef";
  name: string;
  body: { [k: string]: ThemeValue };
  pos: Pos;
};

// ----- motion layer (reusable, scoped animations; v0.2 M5) -----
// A purely-presentational definition modeled on `theme`: the body is a record
// literal (so it cannot reference slots/effects — purity is structural).
export type MotionDef = {
  kind: "MotionDef";
  name: string;
  body: { [k: string]: ThemeValue };
  pos: Pos;
};

export type TypeDef = {
  kind: "TypeDef";
  name: string;
  params: string[];
  body: TypeExpr;
  pos: Pos;
};

export type SlotDef = {
  kind: "SlotDef";
  name: string;
  type: TypeExpr;
  modifier?: "transient" | "volatile";
  init: Expr;
  pos: Pos;
};

export type ReducerDef = {
  kind: "ReducerDef";
  name: string;
  on: EventPattern;
  do: Statement[];
  pos: Pos;
};

export type TileDef = {
  kind: "TileDef";
  name: string;
  in?: TypeExpr;
  errorBoundary?: string;
  body: TileExpr;
  pos: Pos;
};

export type FnDef = {
  kind: "FnDef";
  name: string;
  params: { name: string; type: TypeExpr }[];
  ret?: TypeExpr;
  body: Expr;
  pos: Pos;
};

export type EffectDef = {
  kind: "EffectDef";
  name: string;
  cap: string;
  inType: TypeExpr;
  outType: TypeExpr;
  policy?: PolicyExpr;
  retry?: RetryExpr;
  mapRequest?: Expr; // record literal usually
  pos: Pos;
};

export type AppDef = {
  kind: "AppDef";
  name: string;
  caps: string[];
  routes: { path: string; tile: string }[];
  init: Expr[];
  theme?: string;
  pos: Pos;
};

// ----- Types -----

export type TypeExpr =
  | {
      kind: "TypePrim";
      name: "Int" | "Text" | "Bool" | "Unit" | "Float" | "Time" | "Bytes";
      pos: Pos;
    }
  | { kind: "TypeRef"; name: string; pos: Pos }
  | { kind: "TypeApp"; name: string; args: TypeExpr[]; pos: Pos }
  | { kind: "TypeRecord"; fields: { name: string; type: TypeExpr }[]; pos: Pos }
  | { kind: "TypeUnion"; variants: { name: string; payloads: TypeExpr[] }[]; pos: Pos }
  | { kind: "TypeNominal"; inner: TypeExpr; refinement?: Refinement; pos: Pos }
  | { kind: "TypeRefinement"; inner: TypeExpr; refinement: Refinement; pos: Pos };

export type Refinement = {
  kind: "Refinement";
  pred: string;
  args: (number | string)[];
  pos: Pos;
};

// ----- Events -----

export type EventPattern =
  | { kind: "UiEvent"; ev: UiEventKind; selector: { tile: string; id?: string }; pos: Pos }
  | { kind: "EffectEvent"; effect: string; outcome: "ok" | "err"; binds: string[]; pos: Pos }
  | { kind: "TimerEvent"; intervalMs: number; name?: string; pos: Pos }
  | { kind: "LifecycleEvent"; name: string; pos: Pos };

export type UiEventKind = "click" | "submit" | "change" | "input" | "focus" | "blur";

// ----- Statements (reducer body) -----

export type Statement =
  | { kind: "SlotAssign"; lvalue: Lvalue; rhs: Expr; pos: Pos }
  | { kind: "LetStmt"; name: string; rhs: Expr; pos: Pos }
  | { kind: "Emit"; effect: string; args: Expr[]; pos: Pos }
  | { kind: "StopTimer"; name: string; pos: Pos }
  | { kind: "ForStmt"; bind: string; iter: Expr; body: Statement[]; pos: Pos }
  | { kind: "IfStmt"; cond: Expr; consequent: Statement[]; alternate: Statement[]; pos: Pos }
  | {
      kind: "MatchStmt";
      scrutinee: Expr;
      arms: { pattern: Pattern; body: Statement[] }[];
      pos: Pos;
    }
  | { kind: "NoopStmt"; pos: Pos };

export type Lvalue =
  | { kind: "LSlot"; name: string; pos: Pos }
  | { kind: "LIndex"; base: Lvalue; index: Expr; pos: Pos }
  | { kind: "LField"; base: Lvalue; field: string; pos: Pos };

// ----- Expressions -----

export type Expr =
  | { kind: "Num"; value: number; pos: Pos }
  | { kind: "Str"; value: string; pos: Pos }
  | { kind: "Bool"; value: boolean; pos: Pos }
  | { kind: "Unit"; pos: Pos }
  | { kind: "Ref"; name: string; pos: Pos }
  | { kind: "BinOp"; op: BinOp; lhs: Expr; rhs: Expr; pos: Pos }
  | { kind: "UnaryOp"; op: "-" | "!"; rhs: Expr; pos: Pos }
  | {
      kind: "FieldAccess";
      base: Expr;
      field: string;
      pos: Pos;
      /**
       * Dispatch decision filled in by the type checker (ADR-002): `"field"`
       * means the receiver is a record with this field, so codegen lowers a
       * field read instead of a method shortcut (kills the #23 shadow). Absent /
       * `"shortcut"` keeps the name-based shortcut dispatch (back-compat — also
       * the case when codegen runs without `check()`).
       */
      accessKind?: "field" | "shortcut";
    }
  | { kind: "Index"; base: Expr; index: Expr; pos: Pos }
  | { kind: "Call"; callee: string; args: Expr[]; pos: Pos } // module-level fns and ctors (TodoId.fresh, math.abs, ...)
  | { kind: "MethodCall"; receiver: Expr; method: string; args: Expr[]; pos: Pos }
  | { kind: "RecordLit"; fields: { name: string; value: Expr }[]; pos: Pos }
  | { kind: "ListLit"; items: Expr[]; pos: Pos }
  | { kind: "MapLit"; entries: { key: Expr; value: Expr }[]; pos: Pos } // also Set if values are unit
  // Test `expect` wildcards (spec/testing.md §8.2.2). Legal only inside a
  // reducer-test `expect`; rejected elsewhere (E0109). `<any-id>` matches any
  // generated id; `<slots.X>` matches slot X's post-execution value.
  | { kind: "Wildcard"; wild: "any-id"; pos: Pos }
  | { kind: "Wildcard"; wild: "slot"; slot: string; pos: Pos }
  | { kind: "MatchExpr"; scrutinee: Expr; arms: MatchArm[]; pos: Pos }
  | { kind: "IfExpr"; cond: Expr; consequent: Expr; alternate: Expr; pos: Pos }
  | { kind: "LetIn"; name: string; value: Expr; body: Expr; pos: Pos }
  | { kind: "Variant"; name: string; payload: Expr[]; pos: Pos }; // e.g., All, Some(x), Loaded(t)

export type MatchArm = {
  pattern: Pattern;
  body: Expr;
};

export type Pattern =
  | { kind: "PVariant"; name: string; binds: string[]; pos: Pos } // All, Some(x), Loaded(x), _ has special form
  | { kind: "PWildcard"; pos: Pos }
  | { kind: "PBind"; name: string; pos: Pos } // single identifier
  | { kind: "PLiteral"; value: number | string | boolean; pos: Pos };

export type BinOp = "+" | "-" | "*" | "/" | "%" | "==" | "!=" | "<" | ">" | "<=" | ">=" | "&" | "|"; // boolean and/or

// ----- Policies -----

export type PolicyExpr =
  | { kind: "PolLatest" }
  | { kind: "PolLatestKey"; key: Expr }
  | { kind: "PolQueue" }
  | { kind: "PolDebounce"; ms: number }
  | { kind: "PolThrottle"; ms: number }
  | { kind: "PolOnce" };

export type RetryExpr =
  | { kind: "RetryNone" }
  | { kind: "RetryLinear"; n: number; ms: number }
  | { kind: "RetryExp"; n: number; ms: number; factor: number };

// ----- Tile expressions -----

export type TileExpr =
  | { kind: "TileCall"; name: string; args: TileArg[]; props: TileProp[]; pos: Pos }
  | { kind: "TileFor"; bind: string; iter: Expr; body: TileExpr; pos: Pos }
  | { kind: "TileWhen"; cond: Expr; body: TileExpr; pos: Pos }
  | { kind: "TileIf"; cond: Expr; consequent: TileExpr; alternate: TileExpr; pos: Pos }
  | { kind: "TileMatch"; scrutinee: Expr; arms: TileMatchArm[]; pos: Pos };

export type TileMatchArm = {
  pattern: Pattern;
  body: TileExpr;
};

export type TileArg = {
  kind: "TileArg";
  name?: string;
  value: Expr | TileExpr;
};

export type TileProp = {
  kind: "TileProp";
  name: string;
  value: Expr;
};
