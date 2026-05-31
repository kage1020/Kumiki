# PoC Phase 3 — Blog SPA が動く実装の仕様

[English](./poc-phase3.md) · 日本語

## 13.1 ゴール

`docs/examples/03-blog-spa.strand` を入力に `strand build` を実行すると、ブラウザで開いて以下が動作する：

- `/` → リダイレクト → `/posts`（投稿一覧）
- 投稿カードをクリック → `/posts/:id`（投稿詳細、Markdown 描画）
- `/about` で About ページ
- 未知のパスは `/404`
- 戻る/進むボタンも history に追従
- `link` 要素はフルリロードしない
- 「Edit」リンクは（auth フェイクで）`/login` にリダイレクト
- HTTP 取得はモックバックエンド（静的 JSON）から

Phase 2 で実装した language + runtime に加えて、**ルーティング** と **HTTP** を入れる。

## 13.2 サポート範囲（Phase 3 追加分）

| カバー | 詳細 |
|---|---|
| `route` slot | runtime が `{path, pattern, params, query, hash}` を自動管理 |
| ルートマッチング | `/posts/:id` 等のパラメータ抽出、`/404` フォールバック、静的リダイレクト `->>` |
| `link(to=...)` 要素 | `href=path` で `<a>` を出し、クリックで navigate effect を発火 |
| `navigate` effect | `nav.push` / `nav.replace` / `nav.back` capability |
| `route.enter(pattern)` reducer | ルート進入時 |
| `route.leave(pattern)` reducer | ルート離脱時 |
| `error-boundary` tile 属性 | parse + 受け入れ（Phase 3 では runtime 動作は最小限） |
| `app.http` 設定 | base-url, headers (slot 参照可), on-401 |
| `http.get` / `http.post` / `http.put` / `http.delete` | fetch() で実装、`map-request` で URL/body 構築、`Decoder.Json` で型 decode |
| `app.http-401` lifecycle | 401 を受信したときの reducer |
| 標準 effect: `toast`, `navigate`, `navigate-replace`, `navigate-back` | 自動登録 |
| 標準 tile: `link`, `markdown` | 追加 |

Phase 3 で **扱わない**:
- SSR / Edge
- Theme の完全反映
- i18n
- A11y 検査
- WebSocket / SSE
- IndexedDB
- Optimistic update の高度な機構（楽観的状態保持・ロールバック）
- 認証フロー全体（login form の submit 後は mock 401 で停止する想定）

## 13.3 受け入れ基準（AC）

### AC-Parse

03-blog-spa.strand の以下が parse 成功：
- `routes` 内の静的リダイレクト `"/" ->> "/posts"`
- `error-boundary = ErrorFallback` tile 属性
- `app.http = { base-url: ..., headers: ..., on-401: doLogout, timeout: 10s }` （values は parser が受け入れ、typecheck はゆるく許す）
- `app.meta = {...}` （同上）

### AC-Typecheck

03-blog-spa.strand は **errors=0** で通る。

### AC-Routing

- 初期表示で `/` にアクセス → リダイレクトされて `/posts` の PostList が描画
- `/about` に link でアクセス → About 表示
- `/posts/:id` の `:id` が `$route.params["id"]` で取れる
- `route.enter("/posts/:id/edit")` reducer が当該ルートで発火（テスト用に slot で記録）
- 戻る/進むボタンも反応（jsdom では `history.back()` を擬似）

### AC-HTTP

- 初期化 (`app.start`) で `loadSession()` と `fetchIndex()` が emit され、それぞれ storage / http に届く
- mock backend の `/api/posts` を fetch → `Loaded([id1, id2, ...])` が postIndex に入る
- 各 post の `/api/posts/:id` を fetch → `Loaded(Post)` が posts[id] に入る
- 401 を返す URL に当たると `doLogout` reducer が呼ばれる

### AC-E2E

- `test/blog.e2e.test.ts`: fetch を mock したうえで上記 routing + HTTP のフローを jsdom で検証

### AC-Browser

`pnpm strand build ../docs/examples/03-blog-spa.strand ../examples-build/blog` の結果を、mock JSON を同梱した状態でブラウザで開いて、posts → detail → about → 404 が回る。

## 13.4 Mock Backend 戦略

実 backend は立てない。代わりに `examples-build/blog/api/` に静的 JSON を置き、現在の `scripts/serve.mjs` がそのまま配信する。

```
examples-build/blog/
├── index.html
├── app.js
├── runtime.js
└── api/
    ├── posts                  ← /api/posts (一覧、List<PostId> を返す)
    ├── posts/<id>             ← /api/posts/:id (Post を返す)
    └── auth/login             ← /api/auth/login (401 を返す)
```

URL のパス末尾に拡張子なしで JSON を置けばよいよう、`serve.mjs` を拡張する。

`app.http.base-url` は `""`（同一オリジン）にし、`/api/posts` のような相対パスを使う。

03-blog-spa.strand の `base-url: "https://api.example.com"` はビルド時にコメントアウト or 空文字に上書き、または **app.strand 修正** で対応する。

## 13.5 実装順序

| step | 内容 | 検証 |
|---|---|---|
| 1 | Parser/Typecheck: 追加 app field と tile 属性 | parser tests pass |
| 2 | Codegen: routing と http 用の glue | snapshot test |
| 3 | Runtime: history + route matching + route slot | router unit test |
| 4 | Runtime: http effect dispatcher | http unit test |
| 5 | Runtime: link / markdown / toast / spinner | runtime test |
| 6 | Mock backend (静的 JSON) | serve.mjs 拡張 |
| 7 | Blog SPA build + E2E | jsdom fetch mock |
| 8 | 手動ブラウザ確認 | スクリーンショット |

## 13.6 設計上の判断

| 判断 | 理由 |
|---|---|
| http は全部 fetch() ベース | Phase 2 で polyfill 入れる必要なし、jsdom も対応 |
| route slot は runtime が自動管理 | アプリ側は読むだけ |
| link は `<a>` 出力 + preventDefault | a11y と中ボタン対応のため |
| error-boundary は受け入れだけ | runtime での panic 捕捉は v0.2 で詳細化 |
| markdown は最小実装 (1 段落 = 1 改行、リンク変換なし) | 完全実装はライブラリ依存になる |
| mock は静的 JSON | サーバ起動を増やさない |
| Decoder は実は無視 (常に JSON parse) | 仕様より緩い |

## 13.7 完了の定義

- AC すべて pass
- Blog SPA のビルドが errors=0
- jsdom E2E (一覧→詳細→404→戻る) が通る
- ブラウザで手動確認 OK
