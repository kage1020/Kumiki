# AI Editing API / CRDT op

Implement the CLI described in `../spec/ai-edit.md` and bring to life the core of Kumiki's "AI-only" philosophy: **structured editing + referential integrity + op-log**.

We do not build a full CRDT graph store; instead it runs on a per-`.kumiki`-file **read-parse-mutate-write**. Convergence of parallel ops is not a full CRDT but at the level of "order the ops, detect parse failures and ref-integrity violations, and reject them."

## Goals

```bash
kumiki list                                    # all definition names
kumiki list slot                               # a specific layer
kumiki view slot.todos                         # a single definition
kumiki view --with-deps reducer.add            # including dependencies
kumiki refs slot.todos                         # referrers
kumiki check                                   # types, references, effects, all of them
kumiki check --strict-a11y                     # treat a11y warnings as errors too
kumiki add slot users 'Map(UserId, User) = {}' # add new
kumiki replace slot.todos 'Map(TodoId, Todo) = {}'
kumiki remove slot.draft                       # error without --cascade if referenced
kumiki remove slot.draft --cascade             # also delete referring spots
kumiki rename slot.draft newTodoText           # rename + rewrite references
kumiki fix                                     # auto-fix detected repairable errors
kumiki fix --apply E0103                       # only a specific code
```

Every op is appended to `<file>.kumiki-ops.jsonl` (reviewable in git).

## Scope

| Feature | Implemented | Notes |
|---|---|---|
| `list [layer]` | ✓ | all definitions or by layer |
| `view <qname>` | ✓ | remembers source-range and slices it out |
| `view --with-deps <qname>` | ✓ | includes transitive dependencies |
| `refs <qname>` | ✓ | list of referrers (file + line) |
| `check [--strict-a11y] [--json]` | ✓ | displays typecheck results |
| `add <layer> <name> <body>` | ✓ | appends to the end of the file |
| `replace <qname> <body>` | ✓ | replaces the target def with a new body |
| `remove <qname> [--cascade]` | ✓ | also auto-generates dependent ops |
| `rename <qname> <new>` | ✓ | rename + replacement of referring spots |
| `fix [--apply] [<code>]` | ✓ | did-you-mean, missing /404, etc. |
| op-log JSONL | ✓ | `<file>.kumiki-ops.jsonl` |
| MCP server | × | deferred to a later phase |
| true CRDT parallel merge | × | approximated by parse + ref-integrity only |

## op-log Format

```jsonl
{"op":"add","layer":"slot","name":"users","body":"Map(UserId, User) = {}","ts":1779000000000,"opId":"op_01..."}
{"op":"rename","layer":"slot","name":"draft","newName":"newTodoText","ts":1779000000001,"opId":"op_02..."}
{"op":"remove","layer":"slot","name":"obsolete","cascade":false,"ts":1779000000002,"opId":"op_03..."}
```

`opId` is a ULID-like monotonically increasing ID. `parent-ops` is omitted for simplicity (substituted by the immediately preceding commit hash).

## Acceptance Criteria

### AC-list/view
- `pnpm kumiki list` displays all 35 definitions of packages/examples/apps/02-todomvc/app.kumiki (the total of type/slot/effect/reducer/fn/tile/app/theme)
- `pnpm kumiki view slot.todos` returns `slot todos : Map(TodoId, Todo) = {}`
- `pnpm kumiki view --with-deps reducer.addTodo` also bundles the related fn / slot

### AC-refs
- `pnpm kumiki refs slot.todos` enumerates the (name, file, line) of the reducer / tile / fn that reference todos

### AC-mutate
- `pnpm kumiki add slot foo 'Int = 0'` adds a slot at the end of the file and records it in the op-log
- `pnpm kumiki replace slot.draft 'Text = ""'` rewrites only the target slot
- `pnpm kumiki remove slot.draft` exits with code 1 + an error if referenced; `--cascade` performs a cascade delete
- `pnpm kumiki rename slot.draft newTodoText` renames the definition + all references

### AC-fix
- Insert a typo such as `slot usres : Int = 0; reducer r on=ui.click(B) do= usres := 1` into packages/examples/apps/02-todomvc/app.kumiki and have `kumiki fix` propose a patch
- Actually apply it with `--apply`

### AC-parallel op
- An example where 2 agents independently write ops to JSONL, and replaying them one at a time still converges

## Implementation Order

1. **Definition store**: parse `.kumiki` and build `Map<qname, { def, fileRange }>`
2. **list/view/refs/check**: read-only commands
3. **add/replace/remove/rename**: write-back
4. **op-log**: append JSONL on each mutate op
5. **fix**: generate auto-patches from existing typecheck errors
6. **Parallel op validation**: apply 2 ops in different orders with vitest and get the same result

## Design Notes

- "Real CRDT" requires graph + content-hash + an Add-Wins LWW-Map. This time we approximate with **per-op commits** only
- Because it is file-based, rewriting is at the text level (not the parse level). This keeps the Git diff human-readable too
- Renaming is "renaming the definition line" + "simple replacement of referring spots" (it does not consider language scope). If a scope breaks, it is detected by a subsequent `check`
