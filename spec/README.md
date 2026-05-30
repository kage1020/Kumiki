# Strand 仕様 (spec/)

ここは Strand 言語とランタイムの**正規（normative）仕様**である。実装（`packages/`）と本仕様が食い違った場合、原則として本仕様を正とし、どちらを直すかを設計判断として記録する（→ [../design-notes/](../design-notes/)）。

チュートリアルや how-to は仕様ではなく [../guide/](../guide/) に置く。動作する実例は [../examples/](../examples/) にある。

## 目次

| 文書 | 内容 |
|---|---|
| [language.md](./language.md) | 言語コア — 7 層（type / slot / effect / reducer / tile / fn / app）と式・文・パターン |
| [stdlib.md](./stdlib.md) | 標準ライブラリ — List / Map / Set / Option / Result / Time / ドメイン型 |
| [routing.md](./routing.md) | ルーティング — パターン、パラメータ、`route.enter` / `route.leave`、リダイレクト |
| [style.md](./style.md) | スタイル・レイアウト・テーマ |
| [forms.md](./forms.md) | フォーム、`bind`、バリデーション |
| [http.md](./http.md) | HTTP / Storage effects とポリシー（latest / debounce / once …） |
| [lifecycle.md](./lifecycle.md) | ライフサイクル、ケイパビリティ、エラー境界、サスペンス |
| [runtime.md](./runtime.md) | ランタイム実装ガイド（signal graph・mount・dispatch・dispose） |
| [ai-edit.md](./ai-edit.md) | AI 編集 API、CRDT op、参照整合性 |
| [testing.md](./testing.md) | テスト戦略 |
| [errors.md](./errors.md) | エラーコードカタログ（E0001..E07xx） |
