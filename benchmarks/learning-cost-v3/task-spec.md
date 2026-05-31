# Issue Tracker — Strand Learning-Cost Measurement Task v3

English · [日本語](./task-spec.ja.md)

A large SPA (an estimated 500+ LOC) that measures whether an LLM can write Strand accurately even at scale.
It involves a more complex structure than Pomodoro (90 LOC) / Kanban (200 LOC), multiple routes, filtering, and persistence.

## Feature requirements

A GitHub Issues-style Issue Tracker SPA:

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
- `currentUser : Text = "me"` (simple, no authentication)
- `draft : {title: Text, body: Text, priority: Priority, assignee: Text, tags: Text} = {...initial empty values}` (new-issue form)
- `commentDraft : Text = ""`

### Routes

- `/` → IssueListPage (filter + issue list)
- `/issues/:id` → IssueDetailPage (detail + comments)
- `/new` → NewIssuePage (creation form)
- `/settings` → SettingsPage (theme switching, roughly)
- `/404` → NotFound

### Reducers

- `createIssue`: form submit → create a new Issue, add it to `issues`, navigate("/issues/:newId")
- `updateStatus`: change via the status dropdown on the detail screen
- `updatePriority`: same as above
- `addTag`, `removeTag`: add/remove tags
- `addComment`: add a comment
- `deleteComment`: delete a comment
- `deleteIssue`: delete the Issue (cascade-delete comments too) → navigate("/")
- `setFilterStatus`, `setFilterPriority`, `setSearch`: update the filter
- `clearFilter`: reset the filter
- `loadFromStorage`: restore from localStorage on app.start

### Effects

- `saveIssues` (storage.write, debounce 300ms)
- `saveComments` (storage.write, debounce 300ms)
- `loadIssues`, `loadComments` (storage.read, once)
- Use of `navigate`

### Pure fns

- `filteredIssues(issues, filter) : List(IssueId)` — narrow issues by the filter, descending by updatedAt
- `commentsForIssue(comments, issueId) : List(Text)` — comments linked to issueId
- Display functions such as `statusLabel`, `priorityLabel`, `priorityColor`
- `matchesFilter(issue, filter) : Bool`

### UI

The contents of each page:
- **IssueListPage**: header (title + "New Issue" button), FilterBar (status select / priority select / search input / clear button), an Issue card list (title, status, priority, assignee, tags, createdAt). The empty state is a "No issues" message
- **IssueDetailPage**: back button, title, edit dropdowns for status/priority/assignee, body display, tags display + add input, createdAt/updatedAt display, delete button, comment section (list + new-comment input)
- **NewIssuePage**: title input, body textarea, priority select, assignee input, tags input, submit / cancel buttons
- **SettingsPage**: dark/light theme switching

### Theme

Define a minimal set of color / spacing / typography tokens.

### Persistence

Save and restore `issues` and `comments` in localStorage.

## Constraints

- The output is a single `.strand` file
- Do not use any TypeScript / JSX / React syntax
- Express side effects with effects
- Include the necessary capabilities in the `app` declaration's `caps`

## Output

Write it out as a `.strand` file at the specified path. **Do not leave any stray XML/markdown fence at the end of the file.**

## Evaluation

Score parse / typecheck / build with `reference/scripts/learning-cost-eval.mjs`.
The best version also goes through `strand build` + a browser smoke test.
