# はじめに

Kumiki は実験的な「AI ファースト」の Web フレームワークです。アプリを小さな定義の組み合わせ（JSX・Hooks・依存配列・隠れた状態なし）として記述し、ツールチェインが素のブラウザアプリへコンパイルします。このページでは、ゼロから動く例までを数分で辿ります。

> 言語そのものが初めてなら、考え方は [Thinking in Kumiki](./thinking-in-kumiki.md)、実例は [examples](https://github.com/kage1020/Kumiki/tree/main/packages/examples) を参照。1 行ずつ自分で組み立てたいなら [Your First App](./your-first-app.md) へ。

## インストールせずに試す

最速の入口は [Playground](./playground.md) です。コンパイラとランタイムがブラウザ内で動き、左で編集すると右に描画されます。clone もインストールも不要です。

CLI・MCP・自分のファイルを扱うときは、以下のローカル環境を用意してください。

## Kumiki プログラムの見た目

カウンターはわずかな定義です。`slot` が状態、`reducer` がイベントを状態変更に変え、`tile` が状態を UI へ投影し、`app` が全体を束ねます:

```kumiki
slot count : Int = 0

reducer inc on=ui.click(IncBtn) do= count := count + 1

tile IncBtn = button(text="+1")
tile App    = column(heading("Count: " + count), IncBtn)

app Counter
    caps   = []
    routes = {"/" -> App, "/404" -> App}
    init   = []
```

これがメンタルモデルの全体です。`-` / `reset` まで含む完成版は [packages/examples/apps/01-counter/app.kumiki](https://github.com/kage1020/Kumiki/blob/main/packages/examples/apps/01-counter/app.kumiki)、7 レイヤの解説は [Thinking in Kumiki](./thinking-in-kumiki.md) にあります。

## ローカル環境を用意する

**Node.js 22+** と **pnpm** が必要です。Kumiki はまだ npm に公開していないため、リポジトリを clone して動かします:

```sh
git clone https://github.com/kage1020/Kumiki.git
cd Kumiki
pnpm install        # ワークスペースのパッケージをリンク（どのコマンドより先に必須）
pnpm build          # 全パッケージをビルド
pnpm test           # 任意: 全パッケージが緑になることを確認
```

`pnpm install` が `kumiki` コマンドとパッケージ間の import を成立させます。飛ばさないでください。

## 最初の例を動かす

リポジトリにはルートから CLI を呼ぶ `kumiki` スクリプトが入っており、パスは今いる場所（リポジトリルート）基準で書けます:

**check** — `.kumiki` ファイルをパース + 型検査:

```sh
pnpm kumiki check packages/examples/apps/01-counter/app.kumiki
# → ok
```

**build** — 静的アプリにコンパイル:

```sh
pnpm kumiki build packages/examples/apps/01-counter/app.kumiki ./out
# → Wrote out/index.html, app.js, runtime.js
```

`out/index.html` をブラウザで開けばカウンターが動きます（「Count: 0」と、加算・減算・リセットのボタン）。`app.js` は生成された純粋なロジック、`runtime.js` は DOM ランタイムです。

**smoke** — 「コンパイルが通る」だけでなく「実際に動く」ことを確認します。ヘッドレス DOM にマウントしてクリックまで通します:

```sh
pnpm kumiki smoke packages/examples/apps/01-counter/app.kumiki
# → ok — mounted, rendered, 3 interaction(s), no runtime errors
```

`pnpm kumiki` を引数なしで実行すると全サブコマンド（`build` / `check` / `smoke` / `list` / `view` / `refs` / `run`）が表示されます。

## うまくいかないとき

check のエラーはコードと位置付きで出ます:

```
E0103 undef-ref at 3:39: Reference to undefined name "total"
```

コード（ここでは `E0103`）が種類を表します。意味は [エラーカタログ](../spec/errors.md) を参照。多くはタイプミスか定義漏れで、よくある直し方は [Thinking in Kumiki](./thinking-in-kumiki.md) と [recipes](./recipes.md) でカバーしています。

コマンド自体が失敗する場合:

- `Cannot find package '@kumiki/compiler'` や `tsx: command not found` → `pnpm install` の実行漏れです。実行してください。
- `.kumiki` ファイルのパスが見つからない → パスはリポジトリルート基準か確認（`pnpm kumiki` はルートで動きます）。

## エディタ / AI 連携（MCP）

`@kumiki/mcp` は check・build・編集・仕様検索を MCP ツールとして公開し、AI エージェントが Kumiki を一気通貫で操作できます。クライアント設定例は [packages/mcp/README.md](https://github.com/kage1020/Kumiki/blob/main/packages/mcp/README.md) を参照。

## 次へ

- [Your First App](./your-first-app.md) — Counter を 1 レイヤずつ一から書く。
- [Thinking in Kumiki](./thinking-in-kumiki.md) — 7 レイヤと React との違い。
- [Examples](https://github.com/kage1020/Kumiki/tree/main/packages/examples) — 機能別の最小例と完成アプリ。
- [Playground](./playground.md) — ブラウザで引き続き実験する。
