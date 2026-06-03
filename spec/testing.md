# Testing

English · [日本語](./testing.ja.md)

Kumiki testing comes in **three kinds**:

1. **reducer test** — since reducers are pure functions, verify with inputs and expected outputs
2. **effect mock** — mock at the capability guard boundary to verify dispatcher behavior
3. **episode replay** — replay a production trace with mock effects to detect regressions

All are written within the Kumiki language (no external test framework required).

## 8.1 The Test Definition Layer

```ebnf
test-def ::= 'test' identifier '=' test-expr
test-expr ::= reducer-test | tile-test | episode-test | property-test
```

A `test` definition is **the sixth layer**. It is stored in the CRDT graph and run with `kumiki test`. It is not included in the production build.

> **Implementation status (v0.2).** `reducer-test`, `tile-test`, the `kumiki test` runner (name / `prefix*` filtering), and `kumiki fix --auto-patch <test-name>` (§8.7.2) are implemented. The runner prints `PASS` / `FAIL` lines plus `expected` / `actual` / `diff at <path>` and, when it can isolate a scalar leaf, the §8.7.1 value arrow (`"a" -> "b"`) on failure — per-test timings and property-test case counts are **not yet** produced. Also still specified but **not yet implemented**: `property-test` and `episode-test`, `expect` wildcards (`<any-id>` / `<slots.X>`), effect-result mocks inside `reducer-test` (§8.5's multi-step flow — the [scenario runner](#88-integration-tests-browser-driven) covers that shape today), and `--watch` / `--coverage`. See [design-notes/test-runner.md](../design-notes/test-runner.md) and [design-notes/fix-from-test.md](../design-notes/fix-from-test.md).

## 8.2 Reducer Tests

```kumiki
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

```kumiki
test addTodo-empty =
    reducer-test addTodo
        given = {slots: {todos: {}, draft: ""}, event: {type: ui.submit, target: NewTodoForm}}
        expect = {panic: "draft cannot be empty"}
```

## 8.3 Property Tests

```kumiki
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

```kumiki
test foo =
    property-test
        for-all = {x: Int where between(0, 100)}
        ...
```

## 8.4 Tile snapshot Tests

Compare a tile's structure against an expected value:

```kumiki
test counter-display =
    tile-test App
        given = {slots: {count: 5}, in: ()}
        expect = column(
                   heading("Count: 5"),
                   row(DecBtn, ResetBtn, IncBtn))
```

The snapshot is a deep structural comparison. Class names and styles are out of scope for comparison (only those explicitly specified).

## 8.5 Effect mock

Replace an effect's return value:

```kumiki
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

## 8.6 Episode replay

Replay an episode log recorded in production and verify the result:

```kumiki
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

→ Detailed in [Runtime](./runtime.md).

### 8.6.2 Use Cases

- Turn an episode log attached to a bug report into a fixture and make it a regression test
- Confirm that the same input produces the same result even after changing a model / algorithm
- Verify that an old log can be migrated when the schema changes

## 8.7 The Runner

```bash
kumiki test                    # run all tests
kumiki test reducer-test       # reducer-test only
kumiki test addTodo-*          # wildcard filter
kumiki test --watch            # re-run on change
kumiki test --coverage         # coverage (per reducer/effect/tile)
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

### 8.7.2 Fixing from a failing test

`kumiki fix <file> --auto-patch <test-name>` runs the named test and **proposes a patch** from the failure; add `--apply` to write it and re-run (reporting whether the test now passes and whether any other test regressed). It repairs only what it can prove deterministically:

- If the file does not compile, the test can't run — it reuses the [`fix`](./ai-edit.md) typecheck repairs (did-you-mean name fixes, missing `/404`) so the test can run.
- If a tile-test or reducer-test fails on a **string leaf** whose actual value is a *unique* source literal, it replaces that literal with the expected value (the §8.7.1 snapshot case).

Non-literal divergences (numeric slots, wrong operators, effect-list mismatches) are reported as a diff rather than guessed. See [design-notes/fix-from-test.md](../design-notes/fix-from-test.md).

## 8.8 Integration Tests (browser-driven)

E2E is implemented outside the runtime. Use existing tools such as Playwright / Cypress. From the Kumiki side:

- A **`test-id` prop** can be attached to every tile
- The **`data-kumiki-tile`** attribute is automatically applied by the runtime
- The **`window.__KUMIKI__`** exposes internal slots read-only (test-time only)

```javascript
// Playwright example
await page.locator('[data-kumiki-test=add-btn]').click()
const todos = await page.evaluate(() => window.__KUMIKI__.slots.todos)
expect(Object.keys(todos)).toHaveLength(1)
```

## 8.9 Design Decision Record

| Decision | Rationale |
|---|---|
| Write tests within the language | A separate language increases what the AI must learn |
| Input/output comparison suffices since reducers are pure | No mock needed, deterministic |
| Make property tests first-class | Verify reducer invariants structurally |
| Make episode replay first-class | Production bugs can be turned into tests automatically |
| E2E is an external tool | Out of Kumiki's scope; respect existing tools |

## 8.10 The Three Layers of Tooling Verification

Separate from the `test` definitions above (in-language tests), the toolchain provides staged verification. Each layer catches what the previous layer cannot. The important point is that **`check`/`build` passing is not proof of "working."**

| Layer | Command | What it catches | What it doesn't catch |
|---|---|---|---|
| 1. Compile | `kumiki check` / `kumiki build` | syntax, types, reference resolution, codegen | runtime behavior |
| 2. Runtime smoke | `kumiki smoke` | mount exceptions, empty rendering, unhandled rejection (mounts to a headless DOM and operates all button/input/select) | correctness of results |
| 3. Behavior assertions | `test` definitions / example-specific tests | "whether the result is correct" (e.g., non-exception bugs such as a select always ending up at the last option) | — |

### smoke (layer 2)

`kumiki smoke <file>` mounts a compiled app to a headless DOM (jsdom), fires events at all operable elements after the initial render, and at each step monitors for runtime exceptions, console errors, unhandled rejections, and empty rendering. It automatically detects the class of bugs previously verified by a human in the browser, such as "the type passes, but it calls a method that doesn't exist in the runtime and crashes on operation" or "it doesn't render." It is general-purpose and has no app-specific knowledge.

Real rendering in a browser (CSS layout, real focus, etc.) cannot be fully reproduced by jsdom. The **real-browser tier** for that is `@kumiki/e2e` (Chromium / Playwright), which runs in the **same scenario format** as jsdom. The state oracle is likewise `window.__kumikiApp.live`, and displayed text is `innerText` (visible only). In addition, it has browser-only assertions:

- `focused`: that the specified selector is actually focused (detects focus-stealing bugs on re-render)
- `visible` / `hidden`: that it is really visible/invisible per computed style (`display:none`, etc.)

Because it is heavy (browser binaries), it is not included in the default CI tests; it is an opt-in layer used for verifying focus, layout, and real rendering, and for final verification. The **correctness** of results cannot be judged by smoke; the layer-3 assertions handle that.

`@kumiki/mcp` provides an equivalent `kumiki_smoke`, allowing an AI agent to self-verify after editing.

### Scenario Execution (the bridge from layer 2 to 3) and the Autonomous Loop

`kumiki run <file> <scenario.json>` (MCP: `kumiki_run_scenario`) drives the app with a **scenario** and returns a structured trace for each step. This becomes the foundation for a "generate → execute → observe → fix loop without a human in the loop."

- **Action**: `{dispatch, payload?}` (fire a reducer by name) / `{clickText}` / `{click}` / `{fill, value}` / `{choose, value}` / `{navigate}`.
- **Observation**: after each step, record `state` (a slot snapshot), `domText`, `errors`, and `emits` (the fired effects).
- **Assertion (expect)**: `{ noErrors?, state?, domIncludes?, domExcludes? }`. `state` is a **partial match against slot state** (dot-separated paths allowed). Because you can verify state rather than DOM text, it can mechanically detect **non-exception behavior bugs** (the class a human notices by clicking), such as "a select always ending up at the last option." This is equivalent to making the acceptance criteria (AC) of TDD executable.
- **effect script**: `effects: { <name>: [{outcome, value}, ...] }` replaces HTTP / Storage results in order, keeping the loop deterministic and network-independent.

Why this works cleanly in Kumiki: because state is explicit (slots), the oracle is trustworthy; because events are declarative (reducer names), it can be driven precisely; and because effects can be mocked at the capability boundary, it is reproducible. The agent generates "app + scenario (AC)" from requirements and self-corrects by reading the trace, so the human only needs to state the requirements once. The loop procedure is described in `.claude/skills/kumiki-iterate`.

## 8.11 Next

- AI editing and automatic fixing → [AI Editing](./ai-edit.md)
- Runtime internals → [Runtime](./runtime.md)
