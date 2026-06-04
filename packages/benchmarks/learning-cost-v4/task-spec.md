# Project Management Tool — Kumiki Learning-Cost Measurement Task v4

English · [日本語](./task-spec.ja.md)

A large SPA (an estimated 800-1500 LOC) that measures the practical limits of an LLM. It has a deeper hierarchy than the Issue Tracker (727 LOC) and multiple views.

## Feature requirements

An Asana / Linear-style Project Management SPA:

### Types

- `type ProjectId = nominal Text where uuid`
- `type TaskId = nominal Text where uuid`
- `type CommentId = nominal Text where uuid`
- `type Status = Backlog | InProgress | Review | Done`
- `type Priority = Low | Med | High | Critical`
- `type ViewMode = ListView | BoardView`
- `type Project = {id: ProjectId, name: Text, description: Text, color: Text, archived: Bool, createdAt: Time}`
- `type Task = {id: TaskId, projectId: ProjectId, title: Text, description: Text, status: Status, priority: Priority, assignee: Text, dueDate: Option(Time), tags: List(Text), parentTaskId: Option(TaskId), createdAt: Time, updatedAt: Time}`
- `type Comment = {id: CommentId, taskId: TaskId, author: Text, body: Text, createdAt: Time}`
- `type FilterState = {status: Option(Status), priority: Option(Priority), assignee: Text, search: Text}`

### Slots

- `projects : Map(ProjectId, Project) = {}`
- `tasks : Map(TaskId, Task) = {}`
- `comments : Map(CommentId, Comment) = {}`
- `viewMode : ViewMode = ListView`
- `filter : FilterState = {status: None, priority: None, assignee: "", search: ""}`
- `themeName : Text = "Light"`
- `draftProject : {name: Text, description: Text, color: Text} = {...initial empty values}`
- `draftTask : {title: Text, description: Text, priority: Priority, assignee: Text, tags: Text, dueDate: Text} = {...initial empty values}`
- `commentDraft : Text = ""`
- `ready : Bool = false` (localStorage load-complete flag)

### Routes

- `/` → ProjectsPage (Projects list + creation form)
- `/projects/:id` → ProjectPage (task List or Board, view switching, filter bar)
- `/projects/:id/tasks/:taskId` → TaskDetailPage (task detail + subtasks + comments)
- `/projects/:id/new-task` → NewTaskPage (new-task form)
- `/settings` → SettingsPage (theme switcher)
- `/404` → NotFound

### Reducers

Projects:
- `createProject`: form submit → create a new Project, navigate("/projects/:id")
- `archiveProject`: set the archived field to true
- `unarchiveProject`: archived false
- `deleteProject`: delete the Project (cascade-delete related tasks/comments too)

Tasks:
- `createTask`: form submit → create a new Task, go to `/projects/:id/tasks/:taskId`
- `updateTaskStatus`, `updateTaskPriority`, `updateTaskAssignee`, `updateTaskDueDate`: detail edits
- `addTaskTag`, `removeTaskTag`: add/remove tags
- `updateTaskTitle`, `updateTaskDescription`: edits
- `deleteTask`: delete (cascade comments too)
- `moveTaskStatus`: advance to the next status on the Board

Comments:
- `addComment`: add a comment
- `deleteComment`: delete

UI state:
- `setFilterStatus`, `setFilterPriority`, `setFilterAssignee`, `setSearch`, `clearFilter`
- `setViewMode`: List ⇄ Board

Lifecycle:
- `loadAll`: restore projects / tasks / comments from localStorage on app.start
- `toggleTheme`: Light ⇄ Dark

### Effects

- `saveProjects`, `saveTasks`, `saveComments` (storage.write, debounce 300ms)
- `loadProjects`, `loadTasks`, `loadComments` (storage.read, once)
- `navigate` builtin

### Pure fns

- `tasksForProject(tasks, projectId) : List(TaskId)` — tasks belonging to projectId, descending by updatedAt
- `subtasksFor(tasks, parentId) : List(TaskId)` — tasks where parentTaskId == parentId
- `filteredTasks(tasks, projectId, filter) : List(TaskId)` — belonging to projectId and matching the filter
- `tasksByStatus(tasks, projectId, filter, status) : List(TaskId)` — for the Board view
- `commentsForTask(comments, taskId) : List(CommentId)` — comments linked to taskId, ascending by createdAt
- `statusLabel`, `statusColor`, `priorityLabel`, `priorityColor` — for display
- `formatDate(t)` — ISO date display
- `dueDateStatus(dueDate)` — Overdue / Today / Soon / Upcoming / NoDue
- `parseTags(text)` — comma-separated tags
- `routeProjectId(route) : Option(ProjectId)` — extract ProjectId from the URL
- `routeTaskId(route) : Option(TaskId)` — extract TaskId from the URL
- `currentProject(route, projects) : Option(Project)`

### UI

The composition of each page:

- **ProjectsPage**: header + creation form + Project card list (name, description, active count, archived toggle, delete)
- **ProjectPage**: project name + view toggle (List/Board) + filter bar + List/Board display
  - List view: Task card (title, status, priority, assignee, dueDate, tags)
  - Board view: classify task cards across 4 columns (Backlog/InProgress/Review/Done)
- **TaskDetailPage**: back button + title/description editing + status/priority/assignee/dueDate dropdowns + tags + subtask list + comment section
- **NewTaskPage**: a form for title, description, priority, assignee, tags, dueDate
- **SettingsPage**: theme switching

### Theme

Two themes, Light / Dark. A minimal set of color / spacing / typography tokens.

### Persistence

Save and restore `projects`, `tasks`, `comments` in localStorage.

## Constraints

- The output is a single `.kumiki` file
- Do not use TypeScript / JSX / React syntax
- Side effects go through effects
- The necessary capabilities in the `app` declaration's `caps`

## Output

Write it out as a `.kumiki` file at the specified path. **Do not leave any stray XML tags or markdown fence at the end of the file.**

## Evaluation

Score parse / typecheck / build with `benchmarks/scripts/learning-cost-eval.mjs`.
The best version also goes through `kumiki build` + a browser smoke test.
