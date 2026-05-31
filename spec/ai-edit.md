# AI Editing API, CRDT ops, and Referential Integrity

English · [日本語](./ai-edit.ja.md)

Strand code is stored not in physical files but in a **content-addressable CRDT graph**. Rather than editing text files, an AI agent issues **structured editing operations (ops)**.

This provides:

- Per-file merge conflicts cannot occur in principle
- The impact scope of an edit can be computed statically
- References don't break on rename (hash is invariant)
- An **automatic repair loop** can be run when an edit fails

## 9.1 Overview

```
┌─────────────────────────────────────────────────┐
│                 CRDT graph store                  │
│  (a set of definitions, each content-addressable) │
└─────────────────────────────────────────────────┘
        ↑                          ↓
        │                          │ strand view
        │ strand op apply          │
        │                          ↓
┌──────────────┐          ┌──────────────────────┐
│   AI agent   │ ←─────── │ projection (text)    │
└──────────────┘  edit op └──────────────────────┘
```

What the AI sees is a **projection (a text cross-section)** of the graph. What the AI outputs is an **op** (not a text diff).

---

## 9.2 The strand CLI

### 9.2.1 Read Commands

```bash
strand view <selector>              # render a definition as text and output it
strand view slot.todos              # a single definition
strand view 'slot.*'                # wildcard
strand view --with-deps reducer.add # output related definitions together
strand view --hash slot.todos       # display the content-hash
strand view --history slot.todos    # this definition's edit history
strand view --refs slot.todos       # list the referrers of this definition
strand list <layer>                 # all definition names within a layer
strand list                         # all definition names (with layer prefix)
```

### 9.2.2 Write Commands

```bash
strand add <layer> <name> <body>            # add a new definition
strand replace <layer>.<name> <body>        # replace a definition
strand edit <layer>.<name> <patch>          # partial edit (e.g., inside a reducer's do=)
strand rename <layer>.<old> <new>           # rename (hash invariant)
strand remove <layer>.<name>                # remove (fails if referenced)
strand patch apply <file>                   # apply a CRDT op bundle
strand patch revert <op-id>                 # revert a specific op
```

### 9.2.3 Validation Commands

```bash
strand check                       # types, references, effects, everything
strand check --types               # types only
strand check --refs                # referential integrity only
strand check --effects             # capability/policy consistency only
strand check --a11y                # accessibility conventions
```

### 9.2.4 Fix Assistance

```bash
strand fix --auto-patch <error-id>          # propose a CRDT op that auto-fixes the error
strand fix --apply                          # apply the proposal as-is
strand fix --interactive                    # apply proposals one at a time with confirmation
```

## 9.3 The Form of a CRDT op

### 9.3.1 op Kinds

| op | Meaning |
|---|---|
| `add` | Add a new definition |
| `replace` | Replace a definition body |
| `edit` | Edit part of a definition (field update, adding/removing statements inside a reducer's do=, etc.) |
| `rename` | Rename (hash invariant; references updated by a separate op) |
| `remove` | Remove a definition (dependent ops auto-generated) |
| `link` | Add a reference (explicit) |
| `unlink` | Remove a reference (explicit) |

### 9.3.2 Wire Format

```json
{
  "op": "add",
  "layer": "slot",
  "name": "todos",
  "body": "Map(TodoId, Todo) = {}",
  "author": "agent:claude-1",
  "ts": 1779884546123,
  "op-id": "op_01JC...",
  "parent-ops": ["op_01JB..."],
  "depends-on": ["type:TodoId@h:9ab3...", "type:Todo@h:7cde..."]
}
```

| Field | Meaning |
|---|---|
| `op` | op kind |
| `layer` | target layer |
| `name` | target name |
| `body` | new body (required for add/replace) |
| `author` | issuing agent |
| `ts` | issue time (UNIX ms) |
| `op-id` | the op's ULID |
| `parent-ops` | id of the immediately preceding op this op relies on (CRDT ordering guarantee) |
| `depends-on` | hashes of other definitions the body references (for referential integrity verification) |

### 9.3.3 op Convergence Guarantees

The Strand graph is an **Add-Wins LWW-Map** (last-write-wins + add takes priority over remove).

- When same-name adds come from multiple agents: the winner is decided by the lexicographic order of `op-id`
- When add and remove cross: add wins (better to keep it than to create a dangling reference)
- replace vs replace: the one with the newer ts wins
- rename vs remove: rename wins

These are mathematically guaranteed to converge. However, **semantic consistency requires separate checking** (next section).

## 9.4 Enforcing Referential Integrity

Even though CRDT guarantees syntactic convergence, **semantic conflicts** are a separate matter:

- A: `strand remove slot.draft`
- B: `strand add tile.NewForm input(bind=draft)`

After both converge as CRDT, the reference from `tile.NewForm` to `slot.draft` becomes dangling.

Strand prevents this in **two stages**:

### 9.4.1 Pre-Check at op Issuance

```bash
strand remove slot.draft
# Error: cannot remove slot.draft (referenced by 3 tiles, 2 reducers)
#   tile.NewForm:1
#   tile.Compose:4
#   tile.SearchBox:1
#   reducer.submitNew:2
#   reducer.clearDraft:1
# Use --cascade to remove all dependents, or --force to leave dangling
```

`--cascade` includes the dependents in the same op bundle and removes them too. `--force` tolerates dangling (emits a warning).

### 9.4.2 Post-Check at op Application

When ops from multiple agents arrive simultaneously, the **graph store performs a reference check at the transaction boundary**:

```
transaction begin
  apply op_A (remove slot.draft)
  apply op_B (add tile.NewForm with ref to draft)
check refs
  -> dangling: tile.NewForm -> slot.draft
resolve:
  policy=strict: rollback both ops, mark as conflict
  policy=heal:   add slot.draft back with default value, log conflict
  policy=warn:   apply both, mark warning, emit notification
transaction commit
```

The resolve policy is set via `strand config conflict-policy <strict|heal|warn>`. Default is `strict`.

## 9.5 hash Computation and Reference Resolution

### 9.5.1 hash Computation

```
canonical(body) = AST normalization (identifiers replaced by type hash + position, field names alphabetized, whitespace stripped)
hash(def) = blake3(canonical(def.body) ⊕ hash(dep1) ⊕ hash(dep2) ⊕ ...)
```

### 9.5.2 Reference Resolution

A name reference like `users` in the source text is recorded within the graph store as `slot:hash:9ab3c1...`.

- Name → hash resolution is done at compile time / op application time
- Even with the same name, a different dependency yields a different hash
- Renaming is only a `(rename, name-old, name-new)` op. The hash is invariant

### 9.5.3 Names at Display Time

When retrieved via `strand view`, hashes are turned back into human-readable names (**labels**).

## 9.6 Error Codes and Automatic Repair

All errors are structured:

```json
{
  "code": "E0103",
  "kind": "undef-ref",
  "location": "tile.TodoRow.body:2",
  "message": "Reference to undefined slot 'usres'",
  "suggestion": {
    "kind": "did-you-mean",
    "name": "users",
    "similarity": 0.92
  },
  "auto-patch": {
    "op": "edit",
    "layer": "tile",
    "name": "TodoRow",
    "patch": {"body:2": "replace 'usres' -> 'users'"}
  }
}
```

### 9.6.1 Main Error Codes

| code | Kind |
|---|---|
| `E0101` | undefined type |
| `E0102` | undefined reducer |
| `E0103` | undefined slot |
| `E0104` | undefined effect |
| `E0105` | undefined tile |
| `E0106` | undefined fn |
| `E0201` | type mismatch |
| `E0202` | refinement violation |
| `E0203` | insufficient union exhaustiveness |
| `E0204` | nominal type confusion |
| `E0301` | insufficient capability |
| `E0302` | direct effect call |
| `E0303` | slot write outside a reducer |
| `E0304` | effect emit within a tile |
| `E0305` | slot read/write / effect emit within a fn |
| `E0306` | event selector is not a tile name |
| `E0401` | direct recursion |
| `E0402` | lambda use |
| `E0403` | null use |
| `E0404` | arbitrary predicate |
| `E0501` | referential integrity violation (dangling) |
| `E0502` | circular dependency |
| `E0601` | multiple writes to the same slot |
| `E0701` | a11y warning (label/alt, etc.) |

### 9.6.2 Automatic Repair Loop

```bash
# AI agent script
while true; do
    errors=$(strand check --json)
    if [ -z "$errors" ]; then break; fi
    for err in $errors; do
        if has_auto_patch "$err"; then
            strand patch apply <(echo "$err" | jq .auto-patch)
        else
            # delegate the fix to the AI
            echo "$err" | ai-fix
        fi
    done
done
```

With `strand fix --auto-patch <code>`, errors that have an auto-patch are resolved structurally. Only errors without an auto-patch are placed in the AI's context for it to fix.

## 9.7 MCP Server

Strand can run as a Model Context Protocol server, allowing AI agents to call tools directly:

```bash
strand mcp serve --store ./project.strand-store
```

The tools provided:

| tool name | Arguments | Return value |
|---|---|---|
| `strand_view` | `selector: string, with_deps?: bool` | definition text |
| `strand_list` | `layer?: string` | list of definition names |
| `strand_add` | `layer, name, body` | op-id |
| `strand_replace` | `qname, body` | op-id |
| `strand_edit` | `qname, patch` | op-id |
| `strand_rename` | `qname, new_name` | op-id |
| `strand_remove` | `qname, cascade?: bool` | op-id |
| `strand_check` | `scope?: string` | error list (JSON) |
| `strand_fix` | `error_code, apply?: bool` | patch (JSON) |
| `strand_refs` | `qname` | list of referrers |
| `strand_history` | `qname` | op history |
| `strand_episode` | `episode_id` | episode log |

From the AI, these are called in place of file operations.

## 9.8 Agent Parallel Development Protocol

Coordination when multiple agents edit simultaneously:

### 9.8.1 Concurrency

- Each agent works with a **snapshot of the local graph store**
- The output is an op bundle
- Push ops to the master graph store → converge via CRDT

### 9.8.2 Lock-Free

The graph store takes no locks. ops can be pushed at any time. However:

- They may be rejected by referential integrity
- A rejected agent pulls the latest master and retries

### 9.8.3 Task Boundaries

We want to avoid multiple agents editing the same definition. Task splitting is done by the unit of "**the domain of definition names**":

```
agent-1: slot.todos*, reducer.todo-*, tile.Todo*
agent-2: slot.user*,  reducer.user-*, tile.User*
agent-3: slot.route,  reducer.route-*
```

This is a convention, but an **ownership lock** (optional) can be added to the Strand compiler:

```bash
strand lock agent-1 'slot.todos*,reducer.todo-*'
```

If another agent issues an op in the same namespace, it is rejected.

## 9.9 The Relationship Between episode and op

The runtime episode log is recorded against the build artifact. ops are **the edit history of the source graph**. The two are separated:

| | op log | episode log |
|---|---|---|
| Target | changes to source definitions | runtime state changes |
| Persisted to | graph store | episode store |
| Purpose | parallel development / regression checking | debugging / replay test |
| Unit | CRDT op | reducer execution + effect result |

→ The episode log is in [Runtime](./runtime.md).

## 9.10 Filesystem Compatibility Layer

In early implementation, the graph store can also be **projected as a set of files within a directory**:

```
project.strand/
├── types/
│   ├── User.strand
│   └── TodoId.strand
├── slots/
│   └── todos.strand
├── effects/
│   └── loadTodo.strand
├── reducers/
│   └── add.strand
├── tiles/
│   ├── TodoRow.strand
│   └── App.strand
├── fns/
│   └── matchFilter.strand
└── .strand/
    ├── store.crdt        ← CRDT graph body (binary)
    ├── op-log.jsonl
    └── episode-log.jsonl
```

`strand sync` performs bidirectional sync: file edit → convert to op → apply to store, or store change → reflect to files.

This allows coexistence with existing Git-based workflows. However, **the true source of compatibility is on the graph store side**.

## 9.11 Design Decision Record

| Decision | Rationale |
|---|---|
| Edits are structured ops, not file diffs | Semantically safe in parallel merges |
| Referential integrity in two stages, at op issuance and application | Structurally prevents semantic conflicts in CRDT |
| Automatic repair loop | Structurally shortens the AI's debugging cycle |
| Provide an MCP server | Usable directly from AI agents |
| Optional ownership lock | Mechanizes the convention for parallel development |
| Compatibility with file projection | Coexists with existing tools (Git/editors) |

---

## 9.12 Next

- Runtime implementation details → [Runtime](./runtime.md)
- Complete examples → [examples/](../examples/)
