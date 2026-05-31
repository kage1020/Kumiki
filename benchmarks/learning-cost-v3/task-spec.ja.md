# Issue Tracker — Strand 学習コスト測定タスク v3

[English](./task-spec.md) · 日本語

大規模 SPA (500+ LOC 想定) で LLM がスケール時にも Strand を正確に書けるかを測る。
Pomodoro (90 LOC) / Kanban (200 LOC) より複雑な構造、複数 routes、フィルタリング、永続化を含む。

## 機能要件

GitHub Issues 風の Issue Tracker SPA:

### Types

- `type IssueId = nominal Text where uuid`
- `type Status = Open | InProgress | Done`
- `type Priority = Low | Med | High`
- `type Issue = {id: IssueId, title: Text, body: Text, status: Status, priority: Priority, assignee: Text, tags: List(Text), createdAt: Time, updatedAt: Time}`
- `type Comment = {id: Text, issueId: IssueId, author: Text, body: Text, createdAt: Time}`
- `type FilterState = {status: Option(Status), priority: Option(Priority), search: Text}`

### Slots

- `issues : Map(IssueId, Issue) = {}`
- `comments : Map(Text, Comment) = {}` (commentId → Comment)
- `filter : FilterState = {status: None, priority: None, search: ""}`
- `currentUser : Text = "me"` (簡易、認証なし)
- `draft : {title: Text, body: Text, priority: Priority, assignee: Text, tags: Text} = {...初期空値}` (新規 issue フォーム)
- `commentDraft : Text = ""`

### Routes

- `/` → IssueListPage (フィルタ + Issue 一覧)
- `/issues/:id` → IssueDetailPage (詳細 + コメント)
- `/new` → NewIssuePage (新規作成フォーム)
- `/settings` → SettingsPage (theme 切替程度)
- `/404` → NotFound

### Reducers

- `createIssue`: form 送信 → 新 Issue を生成、`issues` に追加、navigate("/issues/:newId")
- `updateStatus`: 詳細画面の status ドロップダウンで変更
- `updatePriority`: 同上
- `addTag`, `removeTag`: タグ追加/削除
- `addComment`: コメント追加
- `deleteComment`: コメント削除
- `deleteIssue`: Issue 削除（コメントも cascade 削除）→ navigate("/")
- `setFilterStatus`, `setFilterPriority`, `setSearch`: フィルタ更新
- `clearFilter`: フィルタリセット
- `loadFromStorage`: app.start で localStorage から復元

### Effects

- `saveIssues` (storage.write, debounce 300ms)
- `saveComments` (storage.write, debounce 300ms)
- `loadIssues`, `loadComments` (storage.read, once)
- `navigate` 利用

### Pure fns

- `filteredIssues(issues, filter) : List(IssueId)` — issue を filter で絞り、updatedAt 降順
- `commentsForIssue(comments, issueId) : List(Text)` — issueId に紐づくコメント
- `statusLabel`, `priorityLabel`, `priorityColor` 等の表示用関数
- `matchesFilter(issue, filter) : Bool`

### UI

各 page の中身：
- **IssueListPage**: header（タイトル + "New Issue" ボタン）、FilterBar (status select / priority select / search input / clear ボタン)、Issue カードリスト（title, status, priority, assignee, tags, createdAt）。空状態は "No issues" メッセージ
- **IssueDetailPage**: 戻るボタン、title、status/priority/assignee の編集ドロップダウン、body 表示、tags 表示 + 追加 input、createdAt/updatedAt 表示、削除ボタン、コメントセクション (一覧 + 新規コメント入力)
- **NewIssuePage**: title input、body textarea、priority select、assignee input、tags input、submit / cancel ボタン
- **SettingsPage**: ダーク/ライトテーマ切替

### Theme

最低限の色 / spacing / typography トークンを定義。

### 永続化

`issues` と `comments` を localStorage に保存・復元。

## 制約

- 出力は 1 つの `.strand` ファイル
- TypeScript / JSX / React syntax を一切使わない
- 副作用は effect で表現
- `app` 宣言の `caps` に必要な capability を含める

## 出力

指定された path に `.strand` ファイルとして書き出すこと。**ファイル末尾に余計な XML/markdown fence を残さない**。

## 評価

`benchmarks/scripts/learning-cost-eval.mjs` で parse / typecheck / build を採点。
さらにベスト版は `strand build` + ブラウザでの動作確認まで。
