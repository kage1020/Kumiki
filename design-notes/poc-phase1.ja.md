# PoC Phase 1 — Counter が動く実装の仕様

[English](./poc-phase1.md) · 日本語

## ゴール

`examples/apps/01-counter/app.strand` を入力に `strand build` を実行すると、ブラウザで開いて `+` / `−` / `reset` ボタンが機能する単一の SPA がビルドされる。

人間が編集する流れ：

```bash
pnpm install
pnpm build
pnpm --filter @strand/cli exec tsx src/strand.ts build examples/apps/01-counter/app.strand out/counter
node benchmarks/scripts/serve.mjs out/counter 5173
```

→ ブラウザに「Count: 0」+ 3 ボタン。`+` で 1 ずつ加算、`reset` で 0、`−` で減算（refinement で 0 未満は拒否）。

## サポート範囲（Phase 1）

| カバー | 詳細 |
|---|---|
| `type` | `Int` / `Text` / `Bool` / `Unit` / `nominal T where refinement` |
| 述語 | `between(A,B)` のみ |
| `slot` | `slot name : T = init` の単純形 |
| `reducer` | `on=ui.click(TileName)` と `do=` で1〜複数の `slot := expr` |
| `tile` | `column`, `row`, `heading`, `text`, `button` の組み込み 5 要素 |
| 式 | リテラル、識別子、`+`/`-`、`==`/`!=`、文字列連結 |
| `app` | `caps=[] routes={"/" -> App, "/404" -> App} init=[]` |
| ランタイム | DOM 描画、event handler、slot 変更時の dirty 伝播と再描画 |

**Phase 1 で扱わない**: `effect`, `fn`, `match`, `for`, `when`, `if-then-else` 式, `Map`/`Set`/`List`, refinement の他述語, route 解決, テーマ, a11y, AI 編集 API, episode log。

## ディレクトリ構成

```
packages/
├── compiler/
│   └── src/
│       ├── ast.ts            ← AST 型
│       ├── lexer.ts          ← トークナイザ
│       ├── parser.ts         ← 構文解析
│       ├── typecheck.ts      ← 名前解決 + 型確認
│       ├── codegen.ts        ← AST → JS コード
│       └── compile.ts        ← lex→parse→check→codegen 統合
├── runtime/
│   └── src/
│       └── index.ts          ← ランタイムエントリ（mount）、slot ストア + dirty tracking、仮想 tile → DOM 反映
└── cli/
    └── src/
        └── strand.ts         ← strand build コマンド
```

## 受け入れ基準（AC）

TDD で先に固める。

### AC-Lexer

| 入力 | 期待トークン列 |
|---|---|
| `slot count : N = 0` | `[KW(slot), IDENT(count), OP(:), IDENT(N), OP(=), NUM(0)]` |
| `# hello\nx` | `[IDENT(x)]`（コメントは無視） |
| `"hi" + "world"` | `[STR(hi), OP(+), STR(world)]` |
| `nominal Int where between(0, 999)` | `[KW(nominal), IDENT(Int), KW(where), IDENT(between), OP("("), NUM(0), OP(","), NUM(999), OP(")")]` |
| `do= count := count + 1` | `[KW(do), OP(=), IDENT(count), OP(:=), IDENT(count), OP(+), NUM(1)]` |
| 32 文字を超える識別子 | エラー：identifier too long |

### AC-Parser

`examples/apps/01-counter/app.strand` 全体を入力して、AST の以下のノード数：

- TypeDef: 1（N）
- SlotDef: 1（count）
- ReducerDef: 3（inc / dec / reset）
- TileDef: 4（IncBtn / DecBtn / ResetBtn / App）
- AppDef: 1（Counter）

各 reducer に対し `on.kind === "ui.click"` で selector が tile-ref であること、`do[0]` が SlotAssign であること。

### AC-Typecheck

- `count := count + 1` の右辺が `N` 型と適合（Int に refinement）
- `column(heading("Count: " + count), row(DecBtn, ResetBtn, IncBtn))` の全 tile 参照が解決される
- `app.routes` の `"/" -> App` の `App` が定義済み tile であること
- 未定義の `usres` を書いたら E0103 が返る
- 未定義の `FooBtn` を tile body に書いたら E0105 が返る
- 同一 reducer 内で `count := count + 1; count := 0` のように同 slot を 2 回書くと E0601

### AC-Codegen + Runtime

生成された JS をブラウザ上の DOM にマウントしたとき：

- 初期表示で「Count: 0」と 3 ボタンが描画される
- `+` クリックで「Count: 1」に更新される
- 100 回 `+` クリックで「Count: 100」
- 999 で `+` をクリックしても 999 のまま（refinement: between(0,999)）
- `−` を 0 でクリックしても 0 のまま
- `reset` で 0 に戻る
- 副作用は emit されず（Phase 1 では effect 未対応）

### AC-CLI

```bash
pnpm --filter @strand/cli exec tsx src/strand.ts build examples/apps/01-counter/app.strand out/counter
```

- 終了コード 0
- `out/counter/index.html` と `app.js` が作られる
- HTML をブラウザで開くと AC-Runtime の通りに動く

### AC-E2E

`test/e2e.test.ts` で：
- `examples/apps/01-counter/app.strand` を読んで build
- 出力された JS を eval / dynamic import
- jsdom 上で mount
- `+` イベント dispatch → DOM テキストが "Count: 1" に変わる

## 実装順序（TDD）

| step | 内容 | テスト |
|---|---|---|
| 1 | プロジェクトセットアップ | `pnpm test` で 0 件成功 |
| 2 | AST 型 + Lexer | `lexer.test.ts` の全例 |
| 3 | Parser | `parser.test.ts` で `examples/apps/01-counter/app.strand` パース成功 |
| 4 | Typecheck | `typecheck.test.ts` で AC-Typecheck の正常/異常各ケース |
| 5 | Codegen | `codegen.test.ts` で生成 JS が期待形に近い構造 |
| 6 | Runtime | `runtime.test.ts` で jsdom 上のマウント・更新が確認 |
| 7 | CLI | `cli.test.ts` で build コマンドが index.html を作る |
| 8 | E2E + 手動ブラウザ確認 | スクリーンショット |

## 設計上の判断（PoC スコープ）

| 判断 | 理由 |
|---|---|
| PoC は単一パッケージにする | monorepo は次フェーズ。Phase 1 は速度優先 |
| 手書き再帰下降パーサ | 依存追加（acorn/peggy 等）を避け、Strand の構文だけで動く |
| ランタイムは「全 tile 再描画 + DOM diff なし」 | Phase 1 では性能より動作優先。初回描画後は dirty 検知→該当 tile のみ再生成 |
| IR は省略、直接 JS にコード生成 | Phase 1 は IR を介さず短絡。Phase 2 で IR を挟む |
| 開発サーバはビルド出力（`out/`）を直接配信 | strand dev は Phase 2 |
| signal graph も Phase 1 では実装せず | 全 slot 変更時に該当 tile を再描画する素朴な実装 |

## 完了の定義

- 上記 AC がすべて通る
- `out/counter/index.html` をブラウザで開いて手動確認できる
- スクリーンショットが残る
- 既知の制約は README に記載
