# Testing

English · [日本語](./testing.ja.md)

Strand testing comes in **three kinds**:

1. **reducer test** — since reducers are pure functions, verify with inputs and expected outputs
2. **effect mock** — mock at the capability guard boundary to verify dispatcher behavior
3. **episode replay** — replay a production trace with mock effects to detect regressions

All are written within the Strand language (no external test framework required).

---

## 8.1 The Test Definition Layer

```ebnf
test-def ::= 'test' identifier '=' test-expr
test-expr ::= reducer-test | tile-test | episode-test | property-test
```

A `test` definition is **the sixth layer**. It is stored in the CRDT graph and run with `strand test`. It is not included in the production build.

---

## 8.2 Reducer Tests

```strand
test addTodo-basic =
    reducer-test addTodo
        given = {
            slots: {todos: {}, draft: "Hello"},
            event: {type: ui.submit, target: NewTodoForm}
        }
        expect = {
            slots: {todos: {<any-id>: {text: "Hello", done: false}}, draft: ""},
            effects: [persist(<slots.todos>)]
        }
```

### 8.2.1 Syntax

```ebnf
reducer-test ::= 'reducer-test' identifier
                 'given'  '=' '{' 'slots' ':' record-lit ',' 'event' ':' event-lit '}'
                 'expect' '=' '{' 'slots' ':' record-lit ',' 'effects' ':' effect-list '}'

event-lit ::= '{' 'type' ':' event-pattern (',' kv)* '}'
effect-list ::= '[' (effect-call (',' effect-call)*)? ']'
```

### 8.2.2 Wildcards

`<any-id>` means "any generated ID," and `<slots.todos>` means "a reference to the slot value after execution."

### 8.2.3 Expecting a panic

```strand
test addTodo-empty =
    reducer-test addTodo
        given = {slots: {todos: {}, draft: ""}, event: {type: ui.submit, target: NewTodoForm}}
        expect = {panic: "draft cannot be empty"}
```

---

## 8.3 Property Tests

```strand
test toggle-is-involution =
    property-test
        for-all = {todoId: TodoId, todos: Map(TodoId, Todo)}
        given = {slots: {todos: todos}, event: {type: ui.click, target: TodoRow, el: {todoId: todoId}}}
        invariant = run-reducer(toggle).run-reducer(toggle).slots.todos == todos
```

### 8.3.1 Syntax

```ebnf
property-test ::= 'property-test'
                  'for-all'    '=' record-lit       ; variables to generate
                  'given'      '=' record-lit
                  'invariant'  '=' expr
                  ('count'     '=' int)?            ; number of trials (default 100)
                  ('shrink'    '=' bool)?           ; minimize on failure (default true)
```

### 8.3.2 Generators

Each type has an automatic generator:

| Type | Default generation |
|---|---|
| `Int` | -1000 ~ 1000 |
| `Float` | -1000.0 ~ 1000.0 |
| `Text` | 0~50 characters, ASCII |
| `Bool` | true/false |
| `List(T)` | 0~10 elements |
| `Map(K, V)` | 0~10 elements |
| `Set(T)` | 0~10 elements |
| `Option(T)` | 50% None / 50% Some |
| `Result(T, E)` | 50% Ok / 50% Err |
| `nominal T` | T's generator |
| `refinement T where p` | generate T and reject until p is satisfied |

Custom generators:

```strand
test foo =
    property-test
        for-all = {x: Int where between(0, 100)}
        ...
```

---

## 8.4 Tile snapshot Tests

Compare a tile's structure against an expected value:

```strand
test counter-display =
    tile-test App
        given = {slots: {count: 5}, in: ()}
        expect = column(
                   heading("Count: 5"),
                   row(DecBtn, ResetBtn, IncBtn))
```

The snapshot is a deep structural comparison. Class names and styles are out of scope for comparison (only those explicitly specified).

---

## 8.5 Effect mock

Replace an effect's return value:

```strand
test loadUser-success =
    reducer-test fetchUser-flow
        given = {
            slots: {users: {}},
            event: {type: ui.click, target: LoadBtn, el: {userId: "u1"}},
            mocks: {
                loadUser: ok({id: "u1", name: "Alice", email: "a@x.com"})
            }
        }
        expect = {
            slots: {users: {"u1": Loaded({id: "u1", name: "Alice", email: "a@x.com"})}},
            effects: []
        }
```

With `mocks: {effect-name: ok(value) | err(error) | delay(ms, ok(value))}`, you can replace the result of any effect.

---

## 8.6 Episode replay

Replay an episode log recorded in production and verify the result:

```strand
test bug-2026-05-21 =
    episode-test
        load    = "fixtures/episode-2026-05-21.log"
        mocks   = {
            loadUser: from-log,        ; return the result recorded in the log as-is
            persist:  ignore
        }
        expect  = {
            slots-equal: from-log,     ; final slots match the log's record
            no-panics: true
        }
```

### 8.6.1 The Format of the episode log

→ Detailed in [./runtime.md](./runtime.md).

### 8.6.2 Use Cases

- Turn an episode log attached to a bug report into a fixture and make it a regression test
- Confirm that the same input produces the same result even after changing a model / algorithm
- Verify that an old log can be migrated when the schema changes

---

## 8.7 The Runner

```bash
strand test                    # run all tests
strand test reducer-test       # reducer-test only
strand test addTodo-*          # wildcard filter
strand test --watch            # re-run on change
strand test --coverage         # coverage (per reducer/effect/tile)
```

### 8.7.1 Output

```
PASS  addTodo-basic        (1ms)
PASS  toggle-is-involution (100 cases, 23ms)
FAIL  counter-display      
  expected: column(heading("Count: 5"), row(...))
  actual:   column(heading("Count: 0"), row(...))
  diff at:  [0].text  "Count: 5" -> "Count: 0"
```

A mode that **proposes a fix patch** via `strand fix --auto-patch <test-name>` for errors is planned for v0.2.

---

## 8.8 Integration Tests (browser-driven)

E2E is implemented outside the runtime. Use existing tools such as Playwright / Cypress. From the Strand side:

- A **`test-id` prop** can be attached to every tile
- The **`data-strand-tile`** attribute is automatically applied by the runtime
- The **`window.__STRAND__`** exposes internal slots read-only (test-time only)

```javascript
// Playwright example
await page.locator('[data-strand-test=add-btn]').click()
const todos = await page.evaluate(() => window.__STRAND__.slots.todos)
expect(Object.keys(todos)).toHaveLength(1)
```

---

## 8.9 Design Decision Record

| Decision | Rationale |
|---|---|
| Write tests within the language | A separate language increases what the AI must learn |
| Input/output comparison suffices since reducers are pure | No mock needed, deterministic |
| Make property tests first-class | Verify reducer invariants structurally |
| Make episode replay first-class | Production bugs can be turned into tests automatically |
| E2E is an external tool | Out of Strand's scope; respect existing tools |

---

## 8.10 The Three Layers of Tooling Verification

Separate from the `test` definitions above (in-language tests), the toolchain provides staged verification. Each layer catches what the previous layer cannot. The important point is that **`check`/`build` passing is not proof of "working."**

| Layer | Command | What it catches | What it doesn't catch |
|---|---|---|---|
| 1. Compile | `strand check` / `strand build` | syntax, types, reference resolution, codegen | runtime behavior |
| 2. Runtime smoke | `strand smoke` | mount exceptions, empty rendering, unhandled rejection (mounts to a headless DOM and operates all button/input/select) | correctness of results |
| 3. Behavior assertions | `test` definitions / example-specific tests | "whether the result is correct" (e.g., non-exception bugs such as a select always ending up at the last option) | — |

### smoke (layer 2)

`strand smoke <file>` mounts a compiled app to a headless DOM (jsdom), fires events at all operable elements after the initial render, and at each step monitors for runtime exceptions, console errors, unhandled rejections, and empty rendering. It automatically detects the class of bugs previously verified by a human in the browser, such as "the type passes, but it calls a method that doesn't exist in the runtime and crashes on operation" or "it doesn't render." It is general-purpose and has no app-specific knowledge.

Real rendering in a browser (CSS layout, real focus, etc.) cannot be fully reproduced by jsdom. The **real-browser tier** for that is `@strand/e2e` (Chromium / Playwright), which runs in the **same scenario format** as jsdom. The state oracle is likewise `window.__strandApp.live`, and displayed text is `innerText` (visible only). In addition, it has browser-only assertions:

- `focused`: that the specified selector is actually focused (detects focus-stealing bugs on re-render)
- `visible` / `hidden`: that it is really visible/invisible per computed style (`display:none`, etc.)

Because it is heavy (browser binaries), it is not included in the default CI tests; it is an opt-in layer used for verifying focus, layout, and real rendering, and for final verification. The **correctness** of results cannot be judged by smoke; the layer-3 assertions handle that.

`@strand/mcp` provides an equivalent `strand_smoke`, allowing an AI agent to self-verify after editing.

### Scenario Execution (the bridge from layer 2 to 3) and the Autonomous Loop

`strand run <file> <scenario.json>` (MCP: `strand_run_scenario`) drives the app with a **scenario** and returns a structured trace for each step. This becomes the foundation for a "generate → execute → observe → fix loop without a human in the loop."

- **Action**: `{dispatch, payload?}` (fire a reducer by name) / `{clickText}` / `{click}` / `{fill, value}` / `{choose, value}` / `{navigate}`.
- **Observation**: after each step, record `state` (a slot snapshot), `domText`, `errors`, and `emits` (the fired effects).
- **Assertion (expect)**: `{ noErrors?, state?, domIncludes?, domExcludes? }`. `state` is a **partial match against slot state** (dot-separated paths allowed). Because you can verify state rather than DOM text, it can mechanically detect **non-exception behavior bugs** (the class a human notices by clicking), such as "a select always ending up at the last option." This is equivalent to making the acceptance criteria (AC) of TDD executable.
- **effect script**: `effects: { <name>: [{outcome, value}, ...] }` replaces HTTP / Storage results in order, keeping the loop deterministic and network-independent.

Why this works cleanly in Strand: because state is explicit (slots), the oracle is trustworthy; because events are declarative (reducer names), it can be driven precisely; and because effects can be mocked at the capability boundary, it is reproducible. The agent generates "app + scenario (AC)" from requirements and self-corrects by reading the trace, so the human only needs to state the requirements once. The loop procedure is described in `.claude/skills/strand-iterate`.

## 8.11 Next

- AI editing and automatic fixing → [./ai-edit.md](./ai-edit.md)
- Runtime internals → [./runtime.md](./runtime.md)
