# Design Notes (design-notes/)

English · [日本語](./README.ja.md)

This is the **record of Strand's history and decisions**. Rather than the specification itself, it preserves "why it has its current shape." For the current canonical specification, refer to [../spec/](../spec/). The descriptions in this directory are snapshots from the time they were written, and may diverge from the current code.

## Design Rationale

- [rationale.md](./rationale.md) — Strand's design rationale and premises

## Incremental PoC Implementation Records

- [poc-phase1.md](./poc-phase1.md) — Counter
- [poc-phase2.md](./poc-phase2.md) — TodoMVC
- [poc-phase3.md](./poc-phase3.md) — Blog SPA
- [poc-phase4.md](./poc-phase4.md) — Theme, styling, a11y, error boundary
- [poc-ai-edit.md](./poc-ai-edit.md) — AI editing API / CRDT op
- [reference-phase1-status.md](./reference-phase1-status.md) — AC achievement status of the Phase 1 reference implementation

## Benchmarks

- [benchmark.md](./benchmark.md) — Strand vs React (TodoMVC)
- [learning-cost-v1.md](./learning-cost-v1.md) — LLM learning cost v1
- [learning-cost-v2.md](./learning-cost-v2.md) — v2 (cross-model + large-scale + browser validation)
- [learning-cost-v3.md](./learning-cost-v3.md) — v3 (500+ LOC)
- [learning-cost-v4.md](./learning-cost-v4.md) — v4 (800–1500 LOC, full-feature browser operation)

The raw data and measurement scripts are in [benchmarks/](https://github.com/kage1020/Strand/tree/main/benchmarks).
