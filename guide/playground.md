# Playground

ブラウザ上で Strand を編集 → コンパイル → プレビューできる。コンパイラ（`@strand/compiler`）とランタイム（`@strand/runtime`）はブラウザ内で動く。左で編集すると右に結果が出る。`例を選ぶ…` から [機能別カタログ](../examples/features/)の各例を読み込める。

<Playground />

## WebMCP

このページは [WebMCP](https://github.com/webmachinelearning/webmcp) 対応ブラウザ/エージェント向けに、`navigator.modelContext.registerTool` でツールを公開する（対応環境でのみ有効）。

| ツール | 用途 |
|---|---|
| `strand_compile` | 渡した Strand ソースをコンパイルし、成否と診断を返す（read-only） |
| `strand_list_examples` | playground の機能別例の一覧を返す（read-only） |
| `strand_load_example` | 名前を指定して例をエディタに読み込む |
| `strand_set_source` | エディタのソースを差し替えてプレビューする |

ローカル CLI / エディタ統合用には、stdio で動く [`@strand/mcp`](https://github.com/kage1020/strand/tree/main/packages/mcp) サーバーもある。
