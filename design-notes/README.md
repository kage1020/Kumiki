# Design Notes (design-notes/)

English · [日本語](./README.ja.md)

This is the **record of Strand's history and decisions**. Rather than the specification itself, it preserves "why it has its current shape." For the current canonical specification, refer to [Strand Specification](../spec/). The descriptions in this directory are snapshots from the time they were written, and may diverge from the current code.

## Design Rationale

- [Rationale](./rationale.md) — Strand's design rationale and premises

## Incremental PoC Implementation Records

- [PoC Phase 1](./poc-phase1.md) — Counter
- [PoC Phase 2](./poc-phase2.md) — TodoMVC
- [PoC Phase 3](./poc-phase3.md) — Blog SPA
- [PoC Phase 4](./poc-phase4.md) — Theme, styling, a11y, error boundary
- [PoC AI Edit](./poc-ai-edit.md) — AI editing API / CRDT op
- [Reference Phase 1 Status](./reference-phase1-status.md) — AC achievement status of the Phase 1 reference implementation

## Benchmarks

- [Benchmarks](./benchmark.md) — Strand vs React (TodoMVC)
- [Learning Cost v1](./learning-cost-v1.md) — LLM learning cost v1
- [Learning Cost v2](./learning-cost-v2.md) — v2 (cross-model + large-scale + browser validation)
- [Learning Cost v3](./learning-cost-v3.md) — v3 (500+ LOC)
- [Learning Cost v4](./learning-cost-v4.md) — v4 (800–1500 LOC, full-feature browser operation)

The raw data and measurement scripts are in [Benchmarks](https://github.com/kage1020/Strand/tree/main/benchmarks).
