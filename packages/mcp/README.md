# @strand/mcp

Strand コンパイラと AI 編集ツールチェインを **MCP（Model Context Protocol）サーバー**として公開する。エディタや AI エージェントから、Strand プログラムの検査・ビルド・ナビゲーション・編集・仕様参照を行える。

## ツール

| ツール | 用途 |
|---|---|
| `strand_check` | `source` または `path` をパース + 型検査し、診断を返す |
| `strand_build` | 自己完結 JS モジュールへコンパイル（runtime インライン） |
| `strand_smoke` | headless DOM に mount して UI を操作し、ランタイム例外・空描画・未処理 rejection を検出（check/build では捕まらない層） |
| `strand_run_scenario` | シナリオ（操作列 + 状態アサーション）でアプリを駆動し、毎ステップの slot 状態・DOM・エラー・emit を trace として返す。人を介さない生成→実行→観測→修正ループの土台 |
| `strand_list` | ファイル内の定義一覧（layer で絞り込み可） |
| `strand_view` | 定義 1 件の表示（`withDeps` で依存も） |
| `strand_refs` | 定義への参照箇所を検索 |
| `strand_add` / `strand_replace` / `strand_remove` / `strand_rename` | 定義の編集 |
| `strand_fix` | 修復可能な診断の自動パッチ案を提示 |
| `strand_spec_search` / `strand_spec_list` / `strand_spec_get` | 正規仕様（spec/）の検索・一覧・取得 |

## 起動

```sh
pnpm --filter @strand/mcp start
```

MCP クライアント（例: Claude Code）の設定例:

```json
{
  "mcpServers": {
    "strand": {
      "command": "node",
      "args": ["--import", "tsx", "packages/mcp/src/server.ts"]
    }
  }
}
```

`spec/` の場所は通常リポジトリ構成から自動解決される。別配置の場合は環境変数 `STRAND_SPEC_DIR` で上書きする。
