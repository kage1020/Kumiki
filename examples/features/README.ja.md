# Feature Catalog

[English](./README.md) · 日本語

1 ファイル 1 機能の最小例。各ファイルはそれだけで完結した動く Strand アプリであり、CI でパース・型検査・ビルドが検証される。

## 言語コア

| 例 | 内容 |
|---|---|
| [01-slot-and-reducer](https://github.com/kage1020/Strand/blob/main/examples/features/01-slot-and-reducer.strand) | slot（状態）+ reducer（更新）+ tile（描画）の基本サイクル |
| [02-nominal-type](https://github.com/kage1020/Strand/blob/main/examples/features/02-nominal-type.strand) | nominal 型と `between` リファインメント |
| [03-union-and-match](https://github.com/kage1020/Strand/blob/main/examples/features/03-union-and-match.strand) | union 型と `match` 式 |
| [04-record-and-copy](https://github.com/kage1020/Strand/blob/main/examples/features/04-record-and-copy.strand) | レコード型と `.copy(field=value)` 不変更新 |
| [05-pure-fn](https://github.com/kage1020/Strand/blob/main/examples/features/05-pure-fn.strand) | 純粋関数 `fn`（slot を読まない） |
| [06-if-expression](https://github.com/kage1020/Strand/blob/main/examples/features/06-if-expression.strand) | 値としての `if ... then ... else` |

## コレクション・標準ライブラリ

| 例 | 内容 |
|---|---|
| [07-list](https://github.com/kage1020/Strand/blob/main/examples/features/07-list.strand) | `List` の `.map` / `.filter` / `for` |
| [08-map](https://github.com/kage1020/Strand/blob/main/examples/features/08-map.strand) | `Map` の insert / get-or / keys |
| [09-set](https://github.com/kage1020/Strand/blob/main/examples/features/09-set.strand) | `Set` の toggle / has |
| [10-option](https://github.com/kage1020/Strand/blob/main/examples/features/10-option.strand) | `Option` の Some / None |
| [11-time-and-duration](https://github.com/kage1020/Strand/blob/main/examples/features/11-time-and-duration.strand) | `Time` / `Duration` 演算 |
| [22-result](https://github.com/kage1020/Strand/blob/main/examples/features/22-result.strand) | `Result` の Ok / Err とパース |

## UI・スタイル

| 例 | 内容 |
|---|---|
| [12-layout](https://github.com/kage1020/Strand/blob/main/examples/features/12-layout.strand) | column / row / grid とレイアウト prop |
| [13-text-input-bind](https://github.com/kage1020/Strand/blob/main/examples/features/13-text-input-bind.strand) | 入力欄の双方向 `bind` |
| [14-select](https://github.com/kage1020/Strand/blob/main/examples/features/14-select.strand) | 型付き options の select |
| [15-checkbox](https://github.com/kage1020/Strand/blob/main/examples/features/15-checkbox.strand) | チェックボックスと disabled |
| [16-conditional-ui](https://github.com/kage1020/Strand/blob/main/examples/features/16-conditional-ui.strand) | `when(...)` による条件描画 |
| [17-theme](https://github.com/kage1020/Strand/blob/main/examples/features/17-theme.strand) | テーマトークンと動的テーマ切替 |

## アプリレベル

| 例 | 内容 |
|---|---|
| [18-routing](https://github.com/kage1020/Strand/blob/main/examples/features/18-routing.strand) | パスパラメータ・リダイレクト・404 |
| [19-effect-http](https://github.com/kage1020/Strand/blob/main/examples/features/19-effect-http.strand) | HTTP effect と `latest` ポリシー |
| [20-effect-storage](https://github.com/kage1020/Strand/blob/main/examples/features/20-effect-storage.strand) | localStorage 永続化（once / debounce） |
| [21-timer](https://github.com/kage1020/Strand/blob/main/examples/features/21-timer.strand) | `timer(1s)` による定期実行 |
| [23-lifecycle-route-enter](https://github.com/kage1020/Strand/blob/main/examples/features/23-lifecycle-route-enter.strand) | `app.start` / `route.enter` |

新しい質問・バグには、まずここへ最小再現例を足すことで答える。
