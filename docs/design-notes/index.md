# Design Notes (design-notes/)

This is the **record of Kumiki's history and decisions**. Rather than the specification itself, it preserves "why it has its current shape." For the current canonical specification, refer to [Kumiki Specification](../spec/). The descriptions in this directory are snapshots from the time they were written, and may diverge from the current code.

## Roadmap

- [v0.3 Roadmap](./roadmap-v0.3.md) — scope, design, and acceptance criteria for the v0.3 milestone (clean panic handling / receiver type inference) — the type-soundness & robustness milestone
- [v0.2 Roadmap](./roadmap-v0.2.md) — scope, design, and acceptance criteria for the v0.2 milestone (stop-timer / overlay / plugin capabilities / `fix --auto-patch` / `motion` layer)
- [`test` layer & `kumiki test` runner](./test-runner.md) — M4 scope decision: the in-language test DSL + runner (prerequisite for `fix --auto-patch`)
- [`kumiki fix --auto-patch <test-name>`](./fix-from-test.md) — M4b scope decision: which test failures are deterministically repairable, and why the rest are reported

## Architecture Decision Records (ADR)

- [ADR 001 — `motion` is a sibling of `theme`, not an 8th layer](./adr-001-motion-layer.md) — M5: why the motion feature is an auxiliary presentational definition outside the 7-layer model, plus the closed motion grammar
- [ADR 002 — Receiver type inference for method-shortcut dispatch](./adr-002-receiver-type-inference.md) — v0.3 M2 (#23): the checker's first type-inference pass — annotate `FieldAccess` in typecheck, consume in codegen — to stop method shortcuts shadowing record fields, plus the E0108 diagnostic

## Design Rationale

- [Rationale](./rationale.md) — Kumiki's design rationale and premises

## Incremental PoC Implementation Records

- [PoC Phase 1](./poc-phase1.md) — Counter
- [PoC Phase 2](./poc-phase2.md) — TodoMVC
- [PoC Phase 3](./poc-phase3.md) — Blog SPA
- [PoC Phase 4](./poc-phase4.md) — Theme, styling, a11y, error boundary
- [PoC AI Edit](./poc-ai-edit.md) — AI editing API / CRDT op
- [Reference Phase 1 Status](./reference-phase1-status.md) — AC achievement status of the Phase 1 reference implementation

## Benchmarks

- [Benchmarks](./benchmark.md) — Kumiki vs React (TodoMVC)
- [Learning Cost v1](./learning-cost-v1.md) — LLM learning cost v1
- [Learning Cost v2](./learning-cost-v2.md) — v2 (cross-model + large-scale + browser validation)
- [Learning Cost v3](./learning-cost-v3.md) — v3 (500+ LOC)
- [Learning Cost v4](./learning-cost-v4.md) — v4 (800–1500 LOC, full-feature browser operation)

The raw data and measurement scripts are in [Benchmarks](https://github.com/kage1020/Kumiki/tree/main/benchmarks).
