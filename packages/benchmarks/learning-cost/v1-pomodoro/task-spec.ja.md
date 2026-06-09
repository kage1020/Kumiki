# Pomodoro Timer — Kumiki 学習コスト測定タスク

[English](./task-spec.md) · 日本語

このタスクは、Kumiki 仕様だけを context に持つ LLM がどこまで正確に
Kumiki コードを書けるかを測るためのもの。

## 機能要件

Pomodoro タイマー SPA：

1. **2 モード**: `Work`（25分 = 1500秒）と `Break`（5分 = 300秒）
2. **slot `remaining`**: 残り秒数 (整数, 0..1500)
3. **slot `mode`**: 現在のモード（variant `Work | Break`）
4. **slot `running`**: タイマーが動いているか (Bool)
5. **UI**:
   - 現在のモード表示（"Work" または "Break"）
   - 残り時間表示（秒で表示、後で mm:ss にできれば望ましいが必須ではない）
   - `Start` ボタン（停止中なら開始）
   - `Pause` ボタン（動作中なら停止）
   - `Reset` ボタン（現在のモードを最大時間にリセット、停止状態に戻す）
6. **動作**:
   - 動作中は 1 秒ごとに `remaining` が 1 減る
   - `remaining` が 0 に達したらモードを切替（Work → Break、Break → Work）し、新モードの最大時間にリセットして引き続き動作
7. **`app` 宣言**: routes = `{"/" -> App, "/404" -> App}`, caps = `["timer"]`（または同等）

## 制約

- 出力ファイルは 1 つの `.kumiki` ファイル
- TypeScript / JavaScript / React の syntax を混ぜない
- 直接 `setInterval` を呼ばず、`effect timer` を使う
- 全部書き終わったら指定された出力パスに `.kumiki` ファイルとして書き出すこと

## 評価

出力された `.kumiki` を以下で評価する：

| 段階 | 判定 |
|---|---|
| Parse | `lexer + parser` が例外を投げないか |
| Typecheck | `kumiki check` が 0 errors を返すか |
| Build | `kumiki build` が `app.js` を生成できるか |

LOC・トークン数も記録する。
