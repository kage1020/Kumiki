# AI Editing API / CRDT op

English · [日本語](./poc-ai-edit.ja.md)

Implement the CLI described in `../spec/ai-edit.md` and bring to life the core of Strand's "AI-only" philosophy: **structured editing + referential integrity + op-log**.

We do not build a full CRDT graph store; instead it runs on a per-`.strand`-file **read-parse-mutate-write**. Convergence of parallel ops is not a full CRDT but at the level of "order the ops, detect parse failures and ref-integrity violations, and reject them."

## Goals

```bash
strand list                                    # all definition names
strand list slot                               # a specific layer
strand view slot.todos                         # a single definition
strand view --with-deps reducer.add            # including dependencies
strand refs slot.todos                         # referrers
strand check                                   # types, references, effects, all of them
strand check --strict-a11y                     # treat a11y warnings as errors too
strand add slot users 'Map(UserId, User) = {}' # add new
strand replace slot.todos 'Map(TodoId, Todo) = {}'
strand remove slot.draft                       # error without --cascade if referenced
strand remove slot.draft --cascade             # also delete referring spots
strand rename slot.draft newTodoText           # rename + rewrite references
strand fix                                     # auto-fix detected repairable errors
strand fix --apply E0103                       # only a specific code
```

Every op is appended to `<file>.strand-ops.jsonl` (reviewable in git).

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
| op-log JSONL | ✓ | `<file>.strand-ops.jsonl` |
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
- `pnpm --filter @strand/cli exec tsx src/strand.ts list` displays all 35 definitions of examples/apps/02-todomvc/app.strand (the total of type/slot/effect/reducer/fn/tile/app/theme)
- `pnpm --filter @strand/cli exec tsx src/strand.ts view slot.todos` returns `slot todos : Map(TodoId, Todo) = {}`
- `pnpm --filter @strand/cli exec tsx src/strand.ts view --with-deps reducer.addTodo` also bundles the related fn / slot

### AC-refs
- `pnpm --filter @strand/cli exec tsx src/strand.ts refs slot.todos` enumerates the (name, file, line) of the reducer / tile / fn that reference todos

### AC-mutate
- `pnpm --filter @strand/cli exec tsx src/strand.ts add slot foo 'Int = 0'` adds a slot at the end of the file and records it in the op-log
- `pnpm --filter @strand/cli exec tsx src/strand.ts replace slot.draft 'Text = ""'` rewrites only the target slot
- `pnpm --filter @strand/cli exec tsx src/strand.ts remove slot.draft` exits with code 1 + an error if referenced; `--cascade` performs a cascade delete
- `pnpm --filter @strand/cli exec tsx src/strand.ts rename slot.draft newTodoText` renames the definition + all references

### AC-fix
- Insert a typo such as `slot usres : Int = 0; reducer r on=ui.click(B) do= usres := 1` into examples/apps/02-todomvc/app.strand and have `strand fix` propose a patch
- Actually apply it with `--apply`

### AC-parallel op
- An example where 2 agents independently write ops to JSONL, and replaying them one at a time still converges

## Implementation Order

1. **Definition store**: parse `.strand` and build `Map<qname, { def, fileRange }>`
2. **list/view/refs/check**: read-only commands
3. **add/replace/remove/rename**: write-back
4. **op-log**: append JSONL on each mutate op
5. **fix**: generate auto-patches from existing typecheck errors
6. **Parallel op validation**: apply 2 ops in different orders with vitest and get the same result

## Design Notes

- "Real CRDT" requires graph + content-hash + an Add-Wins LWW-Map. This time we approximate with **per-op commits** only
- Because it is file-based, rewriting is at the text level (not the parse level). This keeps the Git diff human-readable too
- Renaming is "renaming the definition line" + "simple replacement of referring spots" (it does not consider language scope). If a scope breaks, it is detected by a subsequent `check`
