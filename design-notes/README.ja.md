# 設計ノート (design-notes/)

[English](./README.md) · 日本語

ここは Strand の**経緯と判断の記録**である。仕様そのものではなく、「なぜ今この形なのか」を残す。現在の正規仕様は [../spec/](../spec/) を参照すること。本ディレクトリの記述は、書かれた時点のスナップショットであり、現在のコードと食い違うことがある。

## 設計理念

- [rationale.md](./rationale.md) — Strand の設計理念と前提

## PoC の段階的実装記録

- [poc-phase1.md](./poc-phase1.md) — Counter
- [poc-phase2.md](./poc-phase2.md) — TodoMVC
- [poc-phase3.md](./poc-phase3.md) — Blog SPA
- [poc-phase4.md](./poc-phase4.md) — テーマ・スタイル・a11y・エラー境界
- [poc-ai-edit.md](./poc-ai-edit.md) — AI 編集 API / CRDT op
- [reference-phase1-status.md](./reference-phase1-status.md) — Phase 1 リファレンス実装の AC 達成状況

## ベンチマーク

- [benchmark.md](./benchmark.md) — Strand vs React (TodoMVC)
- [learning-cost-v1.md](./learning-cost-v1.md) — LLM 学習コスト v1
- [learning-cost-v2.md](./learning-cost-v2.md) — v2（クロスモデル + 大規模 + ブラウザ検証）
- [learning-cost-v3.md](./learning-cost-v3.md) — v3（500+ LOC）
- [learning-cost-v4.md](./learning-cost-v4.md) — v4（800–1500 LOC・全機能ブラウザ動作）

生データと測定スクリプトは [benchmarks/](https://github.com/kage1020/Strand/tree/main/benchmarks) にある。
