# Kumiki Reference Implementation — Phase 1

[English](./reference-phase1-status.md) · 日本語

Phase 1 PoC: 01-counter.kumiki を入力に **lexer → parser → typecheck → codegen → runtime** が直列で動き、ブラウザ上で Counter SPA が動作する。

## ステータス

| AC | ステータス |
|---|---|
| AC-Lexer (9 件) | pass |
| AC-Parser (5 件) | pass |
| AC-Typecheck (7 件) | pass |
| AC-Codegen (1 件) | pass |
| AC-Runtime (5 件) | pass |
| AC-CLI (1 件) | pass |
| **合計 28 / 28** | pass |
| 手動ブラウザ確認 | サーバを起動して目視で確認 |

## ディレクトリ

```
packages/
├── compiler/
│   └── src/
│       ├── ast.ts             Phase 1 AST 型
│       ├── lexer.ts           字句解析
│       ├── parser.ts          手書き再帰下降パーサ
│       ├── typecheck.ts       名前解決 + 型確認
│       ├── codegen.ts         AST → JS
│       └── compile.ts         lex→parse→check→codegen
├── runtime/
│   └── src/
│       └── index.ts           mount / DOM 描画 / dispatch
└── cli/
    └── src/
        └── kumiki.ts          kumiki build コマンド
```

## 使い方

### テスト

```bash
pnpm install
pnpm test              # 全 28 件
pnpm test:watch
pnpm lint
```

### Counter のビルド

```bash
pnpm kumiki build examples/apps/01-counter/app.kumiki out/counter
# → out/counter/ に index.html, app.js, runtime.js が出る
```

### ブラウザで動作確認

```bash
node benchmarks/scripts/serve.mjs out/counter 5174
# → ブラウザで http://localhost:5174 を開く
```

期待される動作:

1. `Count: 0` と 3 ボタン `[-]` `[reset]` `[+]` が表示
2. `+` を押すたび 1 ずつ増加
3. 999 で `+` を押しても 999 のまま（refinement `between(0, 999)`）
4. 0 で `-` を押しても 0 のまま
5. `reset` で 0 に戻る

## 既知の制約 (Phase 1 スコープ)

- effect / fn / match / for / when / if-then-else 式 / Map / Set / List 未対応
- ルーティングは AppDef にあるが実行時には解決しない（`/` の tile を描画するだけ）
- テーマ未対応（簡易のインライン CSS のみ）
- a11y 検査未対応
- AI 編集 API 未対応
- episode log 未対応

Phase 2 でこれらを段階的に追加する。

## 設計判断

Phase 1 で意図的に小さくした点:

| 判断 | 理由 |
|---|---|
| signal graph 不採用、毎クリック全描画 | DOM diff なしの素朴実装で動作優先 |
| IR を介さず直接 JS 出力 | Phase 1 で十分動く、Phase 2 で IR を挟む |
| `kumiki build` のみ（dev / check は別途） | コア体験に集中 |
| Vitest jsdom 上で手書き AppShape で runtime をテスト | codegen→runtime の結合は CLI smoke と手動で |
| `new Function` を使わない | セキュリティ警告に従い、tmp ファイル/dynamic import も避けて分離テストに統一 |
