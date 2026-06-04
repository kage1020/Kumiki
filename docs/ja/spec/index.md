# Kumiki 仕様

ここは Kumiki 言語とランタイムの**正規（normative）仕様**である。実装（`packages/`）と本仕様が食い違った場合、原則として本仕様を正とし、どちらを直すかを設計判断として記録する（→ [Design Notes](../design-notes/)）。

チュートリアルや how-to は仕様ではなく [Kumiki Guide](../guide/) に置く。動作する実例は [Kumiki Examples](https://github.com/kage1020/Kumiki/tree/main/packages/examples) にある。

## 目次

| 文書 | 内容 |
|---|---|
| [Language Core](./language.md) | 7 層（type / slot / effect / reducer / tile / fn / app）と式・文・パターン |
| [Standard Library](./stdlib.md) | List / Map / Set / Option / Result / Time / ドメイン型 |
| [Routing](./routing.md) | パターン、パラメータ、`route.enter` / `route.leave`、リダイレクト |
| [Style](./style.md) | スタイル・レイアウト・テーマ |
| [Forms](./forms.md) | フォーム、`bind`、バリデーション |
| [HTTP / Storage](./http.md) | HTTP / Storage effects とポリシー（latest / debounce / once …） |
| [Lifecycle](./lifecycle.md) | ライフサイクル、ケイパビリティ、エラー境界、サスペンス |
| [Runtime](./runtime.md) | ランタイム実装ガイド（signal graph・mount・dispatch・dispose） |
| [AI Editing](./ai-edit.md) | AI 編集 API、CRDT op、参照整合性 |
| [Testing](./testing.md) | テスト戦略 |
| [Error Codes](./errors.md) | エラーコードカタログ（E0001..E07xx） |
