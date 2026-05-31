# レシピ

[English](./recipes.md) · 日本語

各レシピは対応する最小例にリンクする。まず例を見て、詳細は [Kumiki 仕様](../spec/) で確認するのが速い。

## 状態

| やりたいこと | 例 |
|---|---|
| カウンタ的な状態と更新 | [features/01-slot-and-reducer](https://github.com/kage1020/Kumiki/blob/main/examples/features/01-slot-and-reducer.kumiki) |
| 値の範囲・形式を縛る | [features/02-nominal-type](https://github.com/kage1020/Kumiki/blob/main/examples/features/02-nominal-type.kumiki) |
| レコードを不変更新する | [features/04-record-and-copy](https://github.com/kage1020/Kumiki/blob/main/examples/features/04-record-and-copy.kumiki) |
| 純粋なヘルパ関数 | [features/05-pure-fn](https://github.com/kage1020/Kumiki/blob/main/examples/features/05-pure-fn.kumiki) |

## コレクション

| やりたいこと | 例 |
|---|---|
| リストを map / filter / 描画 | [features/07-list](https://github.com/kage1020/Kumiki/blob/main/examples/features/07-list.kumiki) |
| Map に追加・取得・削除 | [features/08-map](https://github.com/kage1020/Kumiki/blob/main/examples/features/08-map.kumiki) |
| Set でトグル | [features/09-set](https://github.com/kage1020/Kumiki/blob/main/examples/features/09-set.kumiki) |
| 任意値（あるかも）を扱う | [features/10-option](https://github.com/kage1020/Kumiki/blob/main/examples/features/10-option.kumiki) |
| 成否を表す | [features/22-result](https://github.com/kage1020/Kumiki/blob/main/examples/features/22-result.kumiki) |
| 日時・期間 | [features/11-time-and-duration](https://github.com/kage1020/Kumiki/blob/main/examples/features/11-time-and-duration.kumiki) |

## UI

| やりたいこと | 例 |
|---|---|
| 行・列・グリッドで並べる | [features/12-layout](https://github.com/kage1020/Kumiki/blob/main/examples/features/12-layout.kumiki) |
| 入力欄と双方向結合 | [features/13-text-input-bind](https://github.com/kage1020/Kumiki/blob/main/examples/features/13-text-input-bind.kumiki) |
| プルダウン | [features/14-select](https://github.com/kage1020/Kumiki/blob/main/examples/features/14-select.kumiki) |
| チェックボックス | [features/15-checkbox](https://github.com/kage1020/Kumiki/blob/main/examples/features/15-checkbox.kumiki) |
| 条件で出し分け | [features/16-conditional-ui](https://github.com/kage1020/Kumiki/blob/main/examples/features/16-conditional-ui.kumiki) |
| テーマ切替 | [features/17-theme](https://github.com/kage1020/Kumiki/blob/main/examples/features/17-theme.kumiki) |

## アプリレベル

| やりたいこと | 例 |
|---|---|
| ルーティング・パラメータ・404 | [features/18-routing](https://github.com/kage1020/Kumiki/blob/main/examples/features/18-routing.kumiki) |
| HTTP からデータ取得 | [features/19-effect-http](https://github.com/kage1020/Kumiki/blob/main/examples/features/19-effect-http.kumiki) |
| localStorage に永続化 | [features/20-effect-storage](https://github.com/kage1020/Kumiki/blob/main/examples/features/20-effect-storage.kumiki) |
| 定期実行（タイマー） | [features/21-timer](https://github.com/kage1020/Kumiki/blob/main/examples/features/21-timer.kumiki) |
| 起動時・画面遷移時の処理 | [features/23-lifecycle-route-enter](https://github.com/kage1020/Kumiki/blob/main/examples/features/23-lifecycle-route-enter.kumiki) |

## 実アプリで組み合わせを見る

- CRUD + Map + Option: [apps/04-issue-tracker](../examples/apps/04-issue-tracker/)
- 入れ子データ + カンバン + テーマ: [apps/05-project-management](../examples/apps/05-project-management/)
