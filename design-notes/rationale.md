# Design Rationale

English · [日本語](./rationale.ja.md)

## Motivation

React is a human-centered optimum. Hooks / Context / JSX are idioms that feel natural for humans to read and write, and are also the culmination of nearly 20 years of trial and error. But as code writing shifts to AI, the following characteristics become friction.

| Friction point | Content |
|---|---|
| Syntactic overhead | JSX/TSX inflates tokens with closing tags, camelCase attributes, and expression embedding |
| Implicit side effects | `useEffect` dependency arrays, stale capture in closures, forgotten cleanup |
| Order-dependent rules | Hooks call order, prohibition inside conditionals, prohibition inside lists |
| Implicit scope | Provider hierarchies, Context resolution, references from descendants |
| Non-local rendering | A parent re-render propagates to children; the complexity of partially suppressing it with `memo` |

These are "writable when the AI writes them," but become sharply harder "**when the AI fixes them or touches them in parallel**." When the cause of a bug lies outside the program (execution history, dependency arrays, stale closures), the AI cannot reason about it without cramming the entire history into the context window.

Kumiki eliminates this friction structurally.

## Design Requirements

1. **Token efficiency**: The same UI can be expressed with fewer tokens than React
2. **Static traceability of side effects**: Which side effect depends on which state and where it fires is self-evident from the syntax
3. **Architectural predictability**: Bug locations are localized; error messages are machine-readable
4. **Resilience to parallel development**: It does not break semantically even when dozens of agents edit simultaneously
5. **Allowing readability to be sacrificed**: Whether humans can read it is a secondary goal. The primary goal is that the AI can write and fix it accurately

## Lessons from Prior Work

The attempts referenced on the way to the design, and the elements adopted / avoided from them:

| Attempt | Adopted | Avoided |
|---|---|---|
| Elm | Complete side-effect isolation, Result/Option types | Boilerplate bloat, the rigidity of prohibiting local state |
| Unison | Content-addressable definitions, hash-based references | Complete disconnection from the text/Git ecosystem |
| Eve / Differential Dataflow | UI as dataflow, declarative queries | IVM computation explosion in high-frequency update trees |
| Hazel / Subtext | Typed holes, zero syntax errors | Worsened developer experience from input friction |
| Dark | Trace-driven deployment, fusion of UI and execution | Ecosystem lock-in |
| SolidJS | Fine-grained reactivity, compile-time dependency analysis | Signal stale problems, hidden tracking scope |
| Qwik | Resumability, O(1) startup after SSR | Learning cost and debugging complexity |
| Hyperscript | DOM locality, zero context switching | Tightly-coupled spaghetti at scale |
| Datomic | Append-only fact log, time-travel queries | Not suited to high-frequency updates |

## Where Four Independent Proposals Converged

The design began as four independent proposals, each from a separate model-assisted exploration that did not see the others:

| Proposal | One-liner |
|---|---|
| **IR + Actor + Effect descriptor** | S-expression IR, Elm Architecture, capability-bearing effects, compile-to-DOM |
| **Loom: Episode-oriented Runtime** | Episode / Intent / Capability / Projection / Trace |
| **Pyramid: Effect-Typed Tile Language** | TSV one declaration per line, 5-layer separation, global slot |
| **Nexus: CRDT-Native Triple-Graph** | Graph DB, Triple op, Reactive Datalog |

Critically comparing the four made one thing clear: **the surface syntax differed, but all of them converged on the same four points.**

### The 4 Cores They Converged On

1. **Side effects are explicit descriptors** (not function calls)
2. **Prohibition / minimization of local state** (all state is statically locatable)
3. **source ≠ runtime** (IR and compilation are mandatory)
4. **append-only causal log** (debug/replay/audit unified onto one foundation)

The only remaining point of contention was **the physical form of the source representation**.

## Kumiki's Position

Kumiki is a hybrid of the 4 proposals. It takes the strong parts of each and covers the weak parts with another proposal.

| Adopted | Origin |
|---|---|
| Forced 7-layer separation (type / slot / effect / reducer / tile / fn / app) | Pyramid + Kumiki extension |
| Capability-bearing effect descriptor | IR+Actor / Pyramid |
| episode log + replay | Loom |
| Content-addressable definition store | IR+Actor / Nexus |
| Named slots (readable names, not opaque IDs) | Pyramid |
| Parallel editing via CRDT op | Nexus |
| Local nesting allowed (S-expression-like only inside tiles) | IR+Actor |
| Graph compiler (statically checks referential integrity) | Nexus |
| `--ai-fix` mode (error → auto-repair loop) | Kumiki new |

### How Kumiki Avoids Each Proposal's Weakness

| Weakness | Origin | Avoidance in Kumiki |
|---|---|---|
| S-expression parenthesis hell | IR+Actor | Nesting allowed only inside tiles, otherwise one declaration per line |
| Effect type propagation hell | IR+Actor | Effects are descriptors; propagation is only the capability set |
| IVM computation explosion in Projection | Loom | Local updates via signal graph (no full rebuild of the projection) |
| trace schema-evolution incompatibility | Loom | Content-hash and episode versioning keep past traces immutable |
| Expressiveness limit of TSV | Pyramid | Nesting allowed inside tiles; a reducer's `do=` allows multiple statements |
| Degeneration into assembly | Pyramid | Named slots + the compiler enforces naming |
| Semantic conflicts in CRDT | Nexus | The compiler checks ref-integrity at the CRDT op level |
| Long-distance references with opaque IDs | Nexus | Names on the surface, hashes internally; references resolved by the CLI |
| Computation cost of Reactive Datalog | Nexus | A compiled signal graph rather than Datalog |

## Terminology

| Term | Meaning |
|---|---|
| **definition** | A single instance of type / slot / effect / reducer / tile / fn / app |
| **layer** | One of the 7 definition categories |
| **fn** | An auxiliary pure function (slot read/write prohibited, effect emit prohibited) |
| **content-hash** | A 256-bit identifier hashing a definition's body and its transitive dependencies |
| **slot** | Named global state |
| **effect** | A pure record value representing a side effect (not execution) |
| **emit** | The operation of emitting an effect value from a reducer |
| **reducer** | A pure function of event → state change + effect emit |
| **tile** | A pure function from slots to a DOM projection |
| **episode** | A causal sequence derived from a single trigger (the set of reducer executions, effect executions, and state changes) |
| **capability** | The set of side-effect permissions declared at app startup |
| **CRDT op** | An editing operation an AI agent performs against the definition store |

## Non-Goals

Kumiki does not aim for the following.

- **Incremental migration of existing React code**: Zero compatibility is fine. New apps only
- **From-scratch development by humans**: Humans can write it, but it is not comfortable
- **Arbitrary DSL/language extensions**: Macros and plugins are not allowed (to keep the AI's learning target single)
- **Dynamic types / runtime type generation**: Everything is static
- **Multiple rendering targets**: DOM only (Native / Canvas are separate languages)

## What to Read Next

- Overall view of the language → [Language Core](../spec/language.md)
- Want to see an example right away → [examples/apps/01-counter/app.kumiki](https://github.com/kage1020/Kumiki/blob/main/examples/apps/01-counter/app.kumiki)
