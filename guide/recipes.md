# Recipes (Reverse Lookup)

English · [日本語](./recipes.ja.md)

Each recipe links to a corresponding minimal example. The fastest path is to look at the example first, then confirm the details in [../spec/](../spec/).

## State

| What you want to do | Example |
|---|---|
| Counter-like state and updates | [features/01-slot-and-reducer](../examples/features/01-slot-and-reducer.strand) |
| Constrain a value's range or format | [features/02-nominal-type](../examples/features/02-nominal-type.strand) |
| Immutably update a record | [features/04-record-and-copy](../examples/features/04-record-and-copy.strand) |
| Pure helper functions | [features/05-pure-fn](../examples/features/05-pure-fn.strand) |

## Collections

| What you want to do | Example |
|---|---|
| map / filter / render a list | [features/07-list](../examples/features/07-list.strand) |
| Add, get, remove on a Map | [features/08-map](../examples/features/08-map.strand) |
| Toggle with a Set | [features/09-set](../examples/features/09-set.strand) |
| Handle an optional value (maybe present) | [features/10-option](../examples/features/10-option.strand) |
| Represent success or failure | [features/22-result](../examples/features/22-result.strand) |
| Date-time and duration | [features/11-time-and-duration](../examples/features/11-time-and-duration.strand) |

## UI

| What you want to do | Example |
|---|---|
| Lay out in rows, columns, or grids | [features/12-layout](../examples/features/12-layout.strand) |
| Two-way binding with an input field | [features/13-text-input-bind](../examples/features/13-text-input-bind.strand) |
| Dropdown | [features/14-select](../examples/features/14-select.strand) |
| Checkbox | [features/15-checkbox](../examples/features/15-checkbox.strand) |
| Show conditionally | [features/16-conditional-ui](../examples/features/16-conditional-ui.strand) |
| Theme switching | [features/17-theme](../examples/features/17-theme.strand) |

## App Level

| What you want to do | Example |
|---|---|
| Routing, parameters, and 404 | [features/18-routing](../examples/features/18-routing.strand) |
| Fetch data over HTTP | [features/19-effect-http](../examples/features/19-effect-http.strand) |
| Persist to localStorage | [features/20-effect-storage](../examples/features/20-effect-storage.strand) |
| Periodic execution (timer) | [features/21-timer](../examples/features/21-timer.strand) |
| Work on startup or route transition | [features/23-lifecycle-route-enter](../examples/features/23-lifecycle-route-enter.strand) |

## See Combinations in Real Apps

- CRUD + Map + Option: [apps/04-issue-tracker](../examples/apps/04-issue-tracker/)
- Nested data + Kanban + theme: [apps/05-project-management](../examples/apps/05-project-management/)
