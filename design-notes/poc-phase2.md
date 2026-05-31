# PoC Phase 2 — Specification of a Working TodoMVC Implementation

English · [日本語](./poc-phase2.ja.md)

## Goal

Running `kumiki build` with `examples/apps/02-todomvc/app.kumiki` as input, opening the result in the browser makes the following work:

- Adding a Todo (input + Enter)
- Toggling done (checkbox)
- Individual deletion (× button)
- Filter (All / Active / Done)
- Clear completed
- Automatic persistence to localStorage (debounce 300ms)
- Todos are retained after reload

Add all the features that did not work in Phase 1.

## Support Scope (Phase 2 additions)

| Covered | Details |
|---|---|
| `type` extensions | record `{a:T, b:U}`, union `A \| B(T) \| C`, generic application `Map(K,V)` / `Option(T)` / `Result(T,E)`, refinements (nonempty / len-lt / uuid / etc), type alias with params |
| `slot` extensions | volatile / transient modifiers, can take Map/Set/List/Option as the initial value |
| `effect` | Full syntax. capability check, policy (latest/latest-per-key/queue/debounce/throttle/once), retry, map-request |
| `reducer` extensions | lifecycle events such as `app.start`, `effect.ok($v, $key)` / `.err($e, $key)`, let, emit, lvalue path (`todos[id].done := v`), `$el.todoId` / `$event.value` |
| `tile` extensions | `in=T`, `for x in c expr`, `when(cond, expr)`, `if e then e else e`, `match e with | P -> e \| ...`, `{key: ...}` props, calling a tile with positional arguments |
| `fn` | Full syntax. Argument types, return type, purity, recursion prohibited |
| Expressions | match, let-in, if-then-else, record literals, map/list/set literals, field access, index, method chains (e.g. Map.keys.sort-by($1)) |
| Built-in tiles | form / input / textarea / check / spinner / skeleton (minimal) |
| Built-ins | TypeName.fresh(), now, Time.format, math, the necessary methods of Map/Set/List/Option/Result |

**Not handled** in Phase 2: routing resolution, full theme support, a11y validation, the AI editing API, the episode log, SSR/Edge, the HTTP capability, IndexedDB, analytics, WebSocket, animation.

## Acceptance Criteria (AC)

Locked down first with TDD.

### AC-Lexer additions

- `300ms`, `2s`, `1m` → lexed as duration literals (or number + identifier)
- `Map(K, V)` → identifier + `(` + identifier + `,` + identifier + `)`
- In addition to the existing tokens, the keywords `match` and `with` are recognized

### AC-Parser: types

```
type Todo = {id: TodoId, text: Text where nonempty, done: Bool, createdAt: Time}
type Filter = All | Active | Done
type LoadResult(T) = Idle | Loading | Loaded(T) | Failed(HttpError)
slot todos : Map(TodoId, Todo) = {}
```

- record / union / generic / refinement (nonempty/uuid/len-lt/email/url) / type param parse
- A collection literal as the initial value is OK too

### AC-Parser: expressions

```
match f with | All -> true | Active -> not t.done | Done -> t.done
todos.filter(not $2.done).size
todos.keys.sort-by(-todos[$1].createdAt.to-ms)
{id, text=draft, done=false, createdAt=now}
let id = TodoId.fresh()
todos[id].done := not todos[id].done
```

- match / let / record literals / method chains / lvalue paths all parse

### AC-Parser: fn / effect

```
fn matchFilter(t: Todo, f: Filter) -> Bool = match f with | All -> true | ...
fn itemsLeft(ts: Map(TodoId, Todo)) -> Int = ts.filter(not $2.done).size

effect loadTodos cap=storage.read
                 in=Unit
                 out=Result(Option(Map(TodoId, Todo)), Text)
                 policy=once
                 map-request={key: "todos", decode: Decoder.Json(Map(TodoId, Todo))}
```

- The full fn / effect syntax parses

### AC-Parser: tile extensions

```
tile TodoRow in=TodoId = row(check(...), text(...), button(...) {todoId: $1})
tile TodoList = column(for id in todos.keys when(matchFilter(todos[id], filter), TodoRow(id) {key: id.show}))
```

- in= arguments, for/when/if, props, tile call with positional+named args

### AC-Typecheck

- Generic applications such as `Map(K, V)` resolve as types
- Reading/writing a slot or emitting inside a `fn` is an error (E0305)
- An `effect` whose cap is not in `app.caps` is an error (E0301)
- An undefined pattern among the variants of a match is an error
- A final slot of an lvalue path that does not exist is an error (E0103)

### AC-Effect Dispatcher

- `emit loadTodos()` calls storage.read via the dispatcher
- The result reaches the `loadTodos.ok($m, _)` / `.err($e, _)` reducers
- `policy=debounce(300ms)` coalesces consecutive calls
- `policy=once` executes only on the first call
- An effect call with an undeclared capability is a runtime no-op + warning

### AC-Runtime extensions

- DOM rendering of `form` + `input` + `check` + `spinner`
- Dynamic list rendering with the `for` loop
- `match` expressions expand into if-else chains and work
- The immutable update of an lvalue path works correctly
- Saving to localStorage and loading at startup

### AC-CLI

```
pnpm kumiki build examples/apps/02-todomvc/app.kumiki out/todomvc
```

- Exit code 0
- As before, index.html / app.js / runtime.js are produced

### AC-E2E (manual)

In the browser:
1. Type text and press Enter → a row is added
2. Press a checkbox → a strikethrough appears
3. Press × → it is deleted
4. Switch the Filter to Active/Done → only the relevant ones are shown
5. Clear completed → done items disappear
6. Reloading restores the same state (localStorage)

## Implementation Order (TDD)

| step | Content | Test |
|---|---|---|
| 1 | AST + lexer extensions | added to lexer.test.ts |
| 2 | parser: type system | added to parser.test.ts |
| 3 | parser: expressions and lvalue paths | same as above |
| 4 | parser: fn / effect / tile control | same as above |
| 5 | typecheck extensions | added to typecheck.test.ts |
| 6 | effect dispatcher | new dispatcher.test.ts |
| 7 | runtime collection helpers + new tile elements | added to runtime.test.ts |
| 8 | codegen extensions | added to codegen.test.ts |
| 9 | TodoMVC build & manual check | E2E |

## Design Decisions (PoC Scope)

| Decision | Reason |
|---|---|
| Focus only on the features that make TodoMVC work | Avoid scope creep |
| Expand match into an if-else chain rather than a switch | Binding the payload of a union variant is hard to write with a switch |
| Implement collections as immutable pure functions | Per the spec, guarantee functional-style behavior |
| Build the effect dispatcher into the runtime | Implement the part that was a stub in Phase 1 |
| The runtime reads/writes localStorage directly | The first example of a capability handler |
| Theme / a11y / routing are for Phase 3 | Not needed for TodoMVC alone |

## Definition of Done

- All AC pass
- Opening `out/todomvc/index.html` in a real browser makes all features work
- Todos are retained after reload (localStorage)
- The existing Counter tests also pass without regression
