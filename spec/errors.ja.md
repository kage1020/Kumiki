# エラーコード仕様

[English](./errors.md) · 日本語

Kumiki のコンパイラ（`@kumiki/compiler`）が報告する診断は、**パースエラー**と**型検査エラー**の 2 系統に分かれる。本書は両者を正規（normative）に列挙する。実装側でコードを追加・変更した場合は、本書も同時に更新しなければならない。

## エラーの形

型検査エラーは `KumikiError` として表現される：

```ts
type KumikiError = {
  code: string;   // "E0103" のような安定識別子
  kind: string;   // "undef-slot" のような機械可読な分類
  message: string; // 人間向けメッセージ（対象名を含む）
  pos: Pos;        // { line, col }
};
```

`code` は永続的な契約であり、一度割り当てたら意味を変えない。`kind` は同一 `code` 配下の細分類で、診断ロジックの分岐に使う。

パースエラーは `ParseError`（`message` + `pos`）として `throw` される。パース段は最初のエラーで停止するため、コードは付与されない。

## コード体系

| 帯 | 領域 |
|---|---|
| `E00xx` | アプリ構造（ルーティングの必須要件など） |
| `E01xx` | 名前解決（未定義の参照） |
| `E02xx` | 型の不一致 |
| `E03xx` | ケイパビリティと純粋性 |
| `E06xx` | reducer の書き込み規則 |
| `E07xx` | アクセシビリティ（a11y） |
| `E08xx` | ランタイムハザード（コンパイルは通るが実行で壊れる書き方） |

## E00xx — 構造

### E0001 `missing-404`

`app.routes` を宣言したアプリは、`/404` パターンのルートを必ず含めなければならない。未マッチのパスはここへフォールバックする。

> `app.routes must include a "/404" entry`

**修正**：`route "/404" -> NotFound` のような 404 用 tile へのルートを追加する。詳細は [Routing](./routing.md)。

### E0002 `duplicate-timer-name`

2 つ以上の `timer(d, name=N)` トリガーが、同じタイマー名 `N` を宣言している。タイマー名は単一のネームスペースを共有し、`stop-timer(N)` が一意に定まるようアプリ内で一意でなければならない。

> `Timer name "<name>" is declared more than once`

**修正**：いずれかのタイマーを改名し、各 `name=` を一意にする。詳細は [Lifecycle](./lifecycle.md) §7.1.5。

## E01xx — 名前解決

### E0102 `undef-reducer`

イベントハンドラ引数 / prop が、存在しない reducer 名を指している。

> `Reference to undefined reducer "<name>"`

**修正**：reducer 名の綴りを確認する。`kumiki fix` が近い名前を提案できる（→ [AI Editing](./ai-edit.md)）。

### E0103 `undef-ref` / `undef-slot`

- `undef-ref`：式中で未定義の名前を参照した。
  > `Reference to undefined name "<name>"`
- `undef-slot`：reducer 本体で未定義の slot へ代入した。
  > `Assignment to undefined slot "<name>"`

**修正**：参照先の slot / 束縛が宣言済みか確認する。

### E0104 `undef-effect`

`emit` の対象が未定義の effect を指している。

> `Reference to undefined effect "<name>"`

### E0106 `undef-timer`

`stop-timer(N)` 文が、どの `timer(d, name=N)` トリガーも宣言していないタイマー名 `N` を参照している。

> `stop-timer refers to undefined timer name "<name>"`

**修正**：綴りを確認するか、`timer(d, name=N)` でタイマーを宣言する。詳細は [Lifecycle](./lifecycle.md) §7.1.5。

### E0105 `undef-tile`

tile 参照、またはルート定義のターゲットが未定義の tile を指している。

> `Reference to undefined tile "<name>"`
> `Route "<path>" targets undefined tile "<name>"`

## E02xx — 型

### E0201 `type-mismatch`

イベントハンドラの引数 / prop が reducer 名でなければならないのに、別種の値だった。

> `Event handler arg "<name>" must be a reducer name`
> `Event handler prop "<name>" must be a reducer name`

## E03xx — ケイパビリティと純粋性

### E0301 `missing-capability`

effect が要求するケイパビリティが `app.caps` で宣言されていない。

> `Effect "<effect>" requires capability "<cap>" which is not declared in app.caps`

**修正**：`app.caps` に必要なケイパビリティを追加する。能力モデルの詳細は [Lifecycle](./lifecycle.md)。

### E0305 `fn-impurity`

`fn`（純粋関数）が slot を読み取っている。`fn` は引数のみに依存しなければならない。

> `fn "<name>" must not read slot "<name>"`

**修正**：必要な slot 値を引数として渡す。

## E06xx — reducer の書き込み規則

### E0601 `duplicate-write`

同一 reducer 内で、同じ slot パス形状（lvalue shape）へ複数回書き込んでいる。1 reducer 1 書き込み（パス形状粒度）の規則に反する。

> `Slot path "<shape>" is written more than once in this reducer`

**補足**：粒度は**パス形状**である。`issues[id].status` と `issues[id].updatedAt` は別形状とみなされ共存できるが、`count` への二重代入は禁止される。理由は [Rationale](../design-notes/rationale.md)。

## E07xx — アクセシビリティ（a11y）

a11y 検査は `check(program, { strictA11y: true })` で有効化される。

### E0701 `a11y-button`

> `button must have a text= argument or aria-label prop`

### E0702 `a11y-image`

> `image must have an alt prop`

### E0703 `a11y-link`

> `link must have inner text or aria-label`

**修正**：可視テキストか、`aria-label` / `alt` を付与する。フォーム全般の指針は [Forms](./forms.md)。

## E08xx — ランタイムハザード

型は通るが実行時に壊れる「書き方」を、`check` の段階で静的に捕まえるための帯。検証の3層モデルは [Testing](./testing.md) §8.10 を参照。

### E0801 `unimplemented-method`

`obj.method(...)` 形式のメソッド呼び出しが、ランタイム／コード生成の実装するメソッド集合に存在しない。綴り間違い（`.fitler`）や、仕様には載っていても未実装のメソッド、別の型のメソッドの誤用（`Option` に `.to-result` など）で起こる。

> `Method ".<name>" is not implemented by the runtime`

**補足**：実装されているメソッド集合は `@kumiki/compiler` の `KNOWN_METHODS`（コード生成の `methodCallJs` と同期）が唯一の正。引数なしメソッドを `()` 付きで呼んだ場合もこの帯で捕捉される。標準ライブラリのメソッド一覧は [Standard Library](./stdlib.md)。

**修正**：正しいメソッド名に直すか、その操作を `match` / `fold` など実装済みの手段で書き換える。未実装の仕様メソッドが必要なら、`packages/` に実装して `examples/` に動く例を足す。
