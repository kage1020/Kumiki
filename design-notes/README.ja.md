# 設計ノート (design-notes/)

[English](./README.md) · 日本語

ここは Kumiki の**経緯と判断の記録**である。仕様そのものではなく、「なぜ今この形なのか」を残す。現在の正規仕様は [Kumiki Specification](../spec/) を参照すること。本ディレクトリの記述は、書かれた時点のスナップショットであり、現在のコードと食い違うことがある。

## ロードマップ

- [v0.2 ロードマップ](./roadmap-v0.2.ja.md) — v0.2 マイルストーンのスコープ・設計・受け入れ基準（stop-timer / overlay / プラグイン capability / `fix --auto-patch` / `motion` レイヤー）

## 設計理念

- [Rationale](./rationale.md) — Kumiki の設計理念と前提

## PoC の段階的実装記録

- [PoC Phase 1](./poc-phase1.md) — Counter
- [PoC Phase 2](./poc-phase2.md) — TodoMVC
- [PoC Phase 3](./poc-phase3.md) — Blog SPA
- [PoC Phase 4](./poc-phase4.md) — テーマ・スタイル・a11y・エラー境界
- [PoC AI Edit](./poc-ai-edit.md) — AI 編集 API / CRDT op
- [Reference Phase 1 Status](./reference-phase1-status.md) — Phase 1 リファレンス実装の AC 達成状況

## ベンチマーク

- [Benchmarks](./benchmark.md) — Kumiki vs React (TodoMVC)
- [Learning Cost v1](./learning-cost-v1.md) — LLM 学習コスト v1
- [Learning Cost v2](./learning-cost-v2.md) — v2（クロスモデル + 大規模 + ブラウザ検証）
- [Learning Cost v3](./learning-cost-v3.md) — v3（500+ LOC）
- [Learning Cost v4](./learning-cost-v4.md) — v4（800–1500 LOC・全機能ブラウザ動作）

生データと測定スクリプトは [Benchmarks](https://github.com/kage1020/Kumiki/tree/main/benchmarks) にある。
