# Kanban Board — Kumiki 学習コスト測定タスク v2

[English](./task-spec.md) · 日本語

中規模 SPA で LLM がどこまで正確に Kumiki を書けるかを測る。Pomodoro より複雑（150〜250 LOC 想定）。

## 機能要件

3 列の Kanban Board SPA:

1. **3 列**: `Todo` / `Doing` / `Done`
2. **type Column = Todo | Doing | Done**
3. **type Card**: `{id: CardId, title: Text, column: Column, createdAt: Time}`
4. **slot cards**: `Map(CardId, Card) = {}`
5. **slot draft**: `Text = ""`（新規カードの入力欄）
6. **UI**:
   - 上部: input + Add ボタン（draft が空でなければ enabled、draft の card を Todo 列に追加）
   - 3 つの列 (Todo / Doing / Done) を横に並べる
   - 各列のヘッダー: 列名 + 件数（例: "Todo (3)"）
   - 各列内の card: title + 矢印ボタン (← →) + 削除ボタン (✕)
   - ← で前の列へ、→ で次の列へ移動（端は無効）
7. **動作**:
   - addCard: draft が non-empty → 新しい card を Todo 列に追加、draft をクリア
   - moveLeft / moveRight: 指定 card を隣の列に移動
   - deleteCard: 指定 card を削除
8. **永続化**: cards を localStorage に保存・復元
9. **theme**: 適度なスタイリング（gap / pad / color）

## 制約

- 出力は 1 つの `.kumiki` ファイル
- TypeScript / JSX を混ぜない
- 副作用は effect で表現
- `app` 宣言で routes/caps を明示

## 出力

指定された path に `.kumiki` ファイルとして書き出すこと。

## 評価

`benchmarks/scripts/learning-cost-eval.mjs` で：
- parse 通過？
- typecheck 通過？
- build 通過？
- LOC, トークン数記録
