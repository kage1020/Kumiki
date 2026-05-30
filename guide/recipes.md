# レシピ（逆引き）

各レシピは対応する最小例にリンクする。まず例を見て、詳細は [../spec/](../spec/) で確認するのが速い。

## 状態

| やりたいこと | 例 |
|---|---|
| カウンタ的な状態と更新 | [features/01-slot-and-reducer](../examples/features/01-slot-and-reducer.strand) |
| 値の範囲・形式を縛る | [features/02-nominal-type](../examples/features/02-nominal-type.strand) |
| レコードを不変更新する | [features/04-record-and-copy](../examples/features/04-record-and-copy.strand) |
| 純粋なヘルパ関数 | [features/05-pure-fn](../examples/features/05-pure-fn.strand) |

## コレクション

| やりたいこと | 例 |
|---|---|
| リストを map / filter / 描画 | [features/07-list](../examples/features/07-list.strand) |
| Map に追加・取得・削除 | [features/08-map](../examples/features/08-map.strand) |
| Set でトグル | [features/09-set](../examples/features/09-set.strand) |
| 任意値（あるかも）を扱う | [features/10-option](../examples/features/10-option.strand) |
| 成否を表す | [features/22-result](../examples/features/22-result.strand) |
| 日時・期間 | [features/11-time-and-duration](../examples/features/11-time-and-duration.strand) |

## UI

| やりたいこと | 例 |
|---|---|
| 行・列・グリッドで並べる | [features/12-layout](../examples/features/12-layout.strand) |
| 入力欄と双方向結合 | [features/13-text-input-bind](../examples/features/13-text-input-bind.strand) |
| プルダウン | [features/14-select](../examples/features/14-select.strand) |
| チェックボックス | [features/15-checkbox](../examples/features/15-checkbox.strand) |
| 条件で出し分け | [features/16-conditional-ui](../examples/features/16-conditional-ui.strand) |
| テーマ切替 | [features/17-theme](../examples/features/17-theme.strand) |

## アプリレベル

| やりたいこと | 例 |
|---|---|
| ルーティング・パラメータ・404 | [features/18-routing](../examples/features/18-routing.strand) |
| HTTP からデータ取得 | [features/19-effect-http](../examples/features/19-effect-http.strand) |
| localStorage に永続化 | [features/20-effect-storage](../examples/features/20-effect-storage.strand) |
| 定期実行（タイマー） | [features/21-timer](../examples/features/21-timer.strand) |
| 起動時・画面遷移時の処理 | [features/23-lifecycle-route-enter](../examples/features/23-lifecycle-route-enter.strand) |

## 実アプリで組み合わせを見る

- CRUD + Map + Option: [apps/04-issue-tracker](../examples/apps/04-issue-tracker/)
- 入れ子データ + カンバン + テーマ: [apps/05-project-management](../examples/apps/05-project-management/)
