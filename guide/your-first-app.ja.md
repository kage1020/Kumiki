# 最初のアプリ — Counter

[English](./your-first-app.md) · 日本語

7 レイヤを順に足しながら、動く Counter を組み立てる。完成形は [../examples/apps/01-counter/app.strand](https://github.com/kage1020/Strand/blob/main/examples/apps/01-counter/app.strand)。

## 1. 状態を宣言する（slot）

```strand
slot count : Int = 0
```

`slot` はミュータブルな状態。型と初期値を持つ。

## 2. 更新を書く（reducer）

```strand
reducer inc on=ui.click(IncBtn) do= count := count + 1
```

`on=` がイベント（ここでは tile `IncBtn` のクリック）、`do=` が状態更新。`:=` が代入。

## 3. UI を組む（tile）

```strand
tile IncBtn = button(text="+1", onClick=inc)
tile App    = column(heading("Count: " + count.show), IncBtn)
```

`tile` は UI 部品。`onClick=inc` でクリックを reducer に結ぶ。`count.show` で数値を文字列化。

## 4. まとめる（app）

```strand
app Counter
    caps   = []
    routes = {"/" -> App, "/404" -> App}
    init   = []
```

`routes` には必ず `/404` を含める（無いと [E0001](../spec/errors.md#e0001-missing-404)）。

## 5. 検査して動かす

```sh
pnpm --filter @strand/cli exec tsx src/strand.ts check counter.strand
pnpm --filter @strand/cli exec tsx src/strand.ts build counter.strand ./out
```

## 発展

- 値の範囲を縛りたい → nominal 型 + refinement（[../examples/features/02-nominal-type.strand](https://github.com/kage1020/Strand/blob/main/examples/features/02-nominal-type.strand)）
- 入力欄と双方向結合 → `bind`（[../examples/features/13-text-input-bind.strand](https://github.com/kage1020/Strand/blob/main/examples/features/13-text-input-bind.strand)）
- 一覧を描く → `for ... in`（[../examples/features/07-list.strand](https://github.com/kage1020/Strand/blob/main/examples/features/07-list.strand)）

考え方の全体像は [thinking-in-strand.md](./thinking-in-strand.md) へ。
