# ADR 002 — メソッドショートカットディスパッチの受け手型推論

**ステータス:** Accepted（v0.3 M2）· **置換:** なし · **関連:** [#23](https://github.com/kage1020/Kumiki/issues/23)、[#7](https://github.com/kage1020/Kumiki/issues/7)、[#5](https://github.com/kage1020/Kumiki/issues/5)、[roadmap-v0.3](./roadmap-v0.3.md)

## 背景

Kumiki のチェッカは **type-light**：名前解決 + a11y + capability で、**型推論なし**。そのため `codegen.ts` の `jsOfExpr` の `FieldAccess` ケースは、`recv.m`（カッコ無しメソッドショートカット、spec/stdlib.md §2.2.3）を、`(base)[field]` のフィールドフォールスルー **より前に・無条件で**、ハードコードされたメソッド名一覧と突き合わせて dispatch する。帰結（issue #23）：

- **shadowing.** record `{head, tail}` への `node.head` は `_s.listHead(node)` → `None`（silent wrong value）；`{abs, rel}` への `r.abs` → `NaN`；record への `resp.get-err` → throw。エスケープハッチもない——カッコ形 `node.head()` も横取りされる。
- **診断なし.** `FieldAccess` 経路は一切検証されないので、未知の `recv.bogus` も `undefined` にコンパイルされる。「FieldAccess / methodCallJs / KNOWN_METHODS を同期保持」の不変条件が非対称（一部のカッコ無しショートカット——`is-ok`、`is-err`、`values`、`entries`、`lower`、`upper`、`sort`、`ms`——が `KNOWN_METHODS` に無く、`.m()` 形が E0801 を踏む）。

修正には**受け手の静的型**が要るが、現状のチェッカはそれを計算していない。

## 決定

### 1. アーキテクチャ — typecheck で推論し AST に注釈、codegen で消費

`compile()` は **同一の `Program` オブジェクト**を `check()` → `codegen()` に渡す。そこでチェッカが（最小限の）推論を行い、各 `FieldAccess` ノードに解決済みの dispatch 判定を**注釈**し、codegen はそれを読む。これで推論が **1 パス**に集約され、codegen 改変は極小、両パスが食い違う型環境を作るリスクも消える。

注釈は `FieldAccess` AST ノードの optional フィールド 1 つ：

```ts
accessKind?: "field" | "shortcut"
```

- `"field"` — 受け手が（解決して）`field` という名のフィールドを**持つ** record。codegen は `(base)[field]` を直接 emit し、メソッドショートカット判定をスキップする。（shadow 解消。）
- `"shortcut"` または**不在** — codegen は現状の名前ベース dispatch を維持。不在は `check()` を経ない codegen 呼び出し（codegen 単体テストなど）を含む——後方互換。

### 2. 推論の範囲 — 語れるところでは健全、語れないところでは沈黙

新しい `inferType(expr, env): TypeExpr | null`（`typecheck.ts`）。`null` は**決定不能 / dynamic** を意味し、推論は決して当て推量しない。環境の型源：

- **slot** — `SlotDef.type`
- **fn 引数** — `FnDef.params[].type`
- **tile `in`** — tile 本体内で `$1` に束縛
- **`let` 束縛** — RHS から推論

`inferType` が解決する構文：リテラル（`Num`→Int/Float、`Str`→Text、`Bool`→Bool、`RecordLit`→構造的 record 型、`ListLit`/`MapLit`）、`Ref`（環境引き）、`FieldAccess`（record フィールド型）、`.get`（`Option(T)`/`Result(T,E)` を unwrap → `T`）、`Index`（List→要素、Map→値）。それ以外（大半のメソッド呼び出し、分岐の食い違う `match`/`if`、reducer payload `$event`/`$el`）は `null` を返す。`resolveType` ヘルパが `TypeRef` 別名（`sym.types` 経由）と `TypeNominal`/`TypeRefinement` を inner 型へ unwrap する。

これは reducer payload bind や `match` bind を**あえて型付けしない**——dynamic にフォールバックする。それらは shadowing しやすい受け手（名前付き record 型の値）ではなく、完全に型付けするにはイベント形状と union narrowing の推論が要り、本 ADR の範囲外。

### 3. dispatch 規則

`recv.field` で `T = resolveType(inferType(recv))` のとき：

| `T` | `field` | 判定 |
|---|---|---|
| record | その record のフィールド | **field** |
| record | 普遍メソッド（`show`） | shortcut |
| record | それ以外 | **診断 E0108** |
| 既知 stdlib 型（List/Map/Set/Option/Result/Text/Int/Float/Bool/Time） | 既知メンバー | shortcut |
| 既知 stdlib 型 | それ以外 | **診断 E0108** |
| `null` / 未解決 | 何でも | shortcut（診断なし） |

「既知メンバー」= `KNOWN_METHODS` とカッコ無し `FieldAccess` ショートカット名の和集合で、codegen から単一の `KNOWN_MEMBERS` 集合として export する。これは**フラット**な集合で型別ではない：M2 は*完全に未知*のメンバー（`recv.bogus`）を捕捉するが、*正しいメソッドを誤った型に*使うケース（`list.get-err`）は reject しない——それは型別メソッド表が要り、明示的な非ゴール（推論が部分的な間は誤検知のリスクもある）。

### 4. 新エラーコード — E0108 `undef-member`

`E01xx` 名前解決帯（E0107 undef-motion の次の空き）。受け手型が**既知**で、`field` がその型のメンバー（record フィールド / 既知メソッド）でも普遍 `show` でもないときに発火。受け手型が未解決のときは診断を**出さない**（dynamic→shortcut フォールバックと整合——型付けできないものは決して flag しない）。

### 5. 対称性の修正

`KNOWN_METHODS` に欠けていたカッコ無し `FieldAccess` ショートカット名（`is-ok`、`is-err`、`values`、`entries`、`lower`、`upper`、`sort`、`ms`）を追加し、すべてのショートカットで `recv.m` と `recv.m()` が一致するようにする。テストで `FIELD_ACCESS_SHORTCUTS ⊆ KNOWN_METHODS` を強制し、将来のショートカットが非対称を再導入できないようにする。

## 帰結

**正の効果.** #23/#7/#5 の silent-wrong-value クラスが型付き受け手で解消；メソッドと同名の record フィールドが正しく読まれる；型付き受け手の未知メンバーが `undefined` でなくコンパイルエラーに；ショートカット集合が対称に。

**負 / 受容.**
- 推論は設計上**部分的**。型のない経路（reducer payload、`match` bind）でのみ到達する record は依然 shortcut dispatch にフォールバックし、そこでは shadow が起こりうる——が、そうした受け手は稀で、フォールバックは M2 以前の挙動（回帰なし）。既知の境界として文書化。
- E0108 は**厳格化**：従来 `recv.bogus` を `undefined` にコンパイルできたプログラムがコンパイル不能に。これは意図した正しさの向上（pre-1.0、minor バンプ）で CHANGELOG に明記。
- 汎用型チェッカではない。M2 はメンバー解決のみ——型不一致診断も HM/双方向推論もなし（ロードマップ非ゴール）。

## 検討した代替案

- **codegen で推論（共有 `inferType`、codegen が自前の型環境）.** 却下：codegen の `EvalCtx` は bind の*名前*しか追わず、全 codegen スコープ（let / match / lambda / tile `$1`）に bind の*型*を通すと環境が二重化しチェッカと食い違うリスク。共有 AST への注釈の方が確実にコードが少なく単一情報源。
- **ショートカット名を record/map フィールド名から予約**（`head` という名のフィールドを禁止）. 却下：dispatch の制限のためにデータモデルを罰する；AI 生成 record は `head`/`last`/`size` を日常的に使う。
- **曖昧性解消にカッコを必須化**（`node.("head")` 等）. 却下：型で解決できる問題に構文を足す；spec 推奨のカッコ無しショートカットに反する。
