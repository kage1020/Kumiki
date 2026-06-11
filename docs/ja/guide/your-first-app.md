# 最初のアプリ — Counter

7 レイヤを順に足しながら、動く Counter を組み立てる。完成形は [packages/examples/apps/01-counter/app.kumiki](https://github.com/kage1020/Kumiki/blob/main/packages/examples/apps/01-counter/app.kumiki)。

## 1. 状態を宣言する（slot）

```kumiki
slot count : Int = 0
```

`slot` はミュータブルな状態。型と初期値を持つ。

## 2. 更新を書く（reducer）

```kumiki
reducer inc on=ui.click(IncBtn) do= count := count + 1
```

`on=` がイベント（ここでは tile `IncBtn` のクリック）、`do=` が状態更新。`:=` が代入。

## 3. UI を組む（tile）

```kumiki
tile IncBtn = button(text="+1", onClick=inc)
tile App    = column(heading("Count: " + count.show), IncBtn)
```

`tile` は UI 部品。`onClick=inc` でクリックを reducer に結ぶ。`count.show` で数値を文字列化。

## 4. まとめる（app）

```kumiki
app Counter
    caps   = []
    routes = {"/" -> App, "/404" -> App}
    init   = []
```

`routes` には必ず `/404` を含める（無いと [E0001](../spec/errors.md#e0001-missing-404)）。

## 5. 検査して動かす

```sh
pnpm --filter @kumiki/cli exec tsx src/kumiki.ts check counter.kumiki
pnpm --filter @kumiki/cli exec tsx src/kumiki.ts build counter.kumiki ./out
```

## 発展

- 値の範囲を縛りたい → nominal 型 + refinement（[packages/examples/features/02-nominal-type.kumiki](https://github.com/kage1020/Kumiki/blob/main/packages/examples/features/02-nominal-type.kumiki)）
- 入力欄と双方向結合 → `bind`（[packages/examples/features/13-text-input-bind.kumiki](https://github.com/kage1020/Kumiki/blob/main/packages/examples/features/13-text-input-bind.kumiki)）
- 一覧を描く → `for ... in`（[packages/examples/features/07-list.kumiki](https://github.com/kage1020/Kumiki/blob/main/packages/examples/features/07-list.kumiki)）

考え方の全体像は [Kumiki の考え方](./thinking-in-kumiki.md) へ。
