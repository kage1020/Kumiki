# Recipes

English · [日本語](./recipes.ja.md)

Each recipe links to a corresponding minimal example. The fastest path is to look at the example first, then confirm the details in [Strand Specification](../spec/).

## State

| What you want to do | Example |
|---|---|
| Counter-like state and updates | [features/01-slot-and-reducer](https://github.com/kage1020/Strand/blob/main/examples/features/01-slot-and-reducer.strand) |
| Constrain a value's range or format | [features/02-nominal-type](https://github.com/kage1020/Strand/blob/main/examples/features/02-nominal-type.strand) |
| Immutably update a record | [features/04-record-and-copy](https://github.com/kage1020/Strand/blob/main/examples/features/04-record-and-copy.strand) |
| Pure helper functions | [features/05-pure-fn](https://github.com/kage1020/Strand/blob/main/examples/features/05-pure-fn.strand) |

## Collections

| What you want to do | Example |
|---|---|
| map / filter / render a list | [features/07-list](https://github.com/kage1020/Strand/blob/main/examples/features/07-list.strand) |
| Add, get, remove on a Map | [features/08-map](https://github.com/kage1020/Strand/blob/main/examples/features/08-map.strand) |
| Toggle with a Set | [features/09-set](https://github.com/kage1020/Strand/blob/main/examples/features/09-set.strand) |
| Handle an optional value (maybe present) | [features/10-option](https://github.com/kage1020/Strand/blob/main/examples/features/10-option.strand) |
| Represent success or failure | [features/22-result](https://github.com/kage1020/Strand/blob/main/examples/features/22-result.strand) |
| Date-time and duration | [features/11-time-and-duration](https://github.com/kage1020/Strand/blob/main/examples/features/11-time-and-duration.strand) |

## UI

| What you want to do | Example |
|---|---|
| Lay out in rows, columns, or grids | [features/12-layout](https://github.com/kage1020/Strand/blob/main/examples/features/12-layout.strand) |
| Two-way binding with an input field | [features/13-text-input-bind](https://github.com/kage1020/Strand/blob/main/examples/features/13-text-input-bind.strand) |
| Dropdown | [features/14-select](https://github.com/kage1020/Strand/blob/main/examples/features/14-select.strand) |
| Checkbox | [features/15-checkbox](https://github.com/kage1020/Strand/blob/main/examples/features/15-checkbox.strand) |
| Show conditionally | [features/16-conditional-ui](https://github.com/kage1020/Strand/blob/main/examples/features/16-conditional-ui.strand) |
| Theme switching | [features/17-theme](https://github.com/kage1020/Strand/blob/main/examples/features/17-theme.strand) |

## App Level

| What you want to do | Example |
|---|---|
| Routing, parameters, and 404 | [features/18-routing](https://github.com/kage1020/Strand/blob/main/examples/features/18-routing.strand) |
| Fetch data over HTTP | [features/19-effect-http](https://github.com/kage1020/Strand/blob/main/examples/features/19-effect-http.strand) |
| Persist to localStorage | [features/20-effect-storage](https://github.com/kage1020/Strand/blob/main/examples/features/20-effect-storage.strand) |
| Periodic execution (timer) | [features/21-timer](https://github.com/kage1020/Strand/blob/main/examples/features/21-timer.strand) |
| Work on startup or route transition | [features/23-lifecycle-route-enter](https://github.com/kage1020/Strand/blob/main/examples/features/23-lifecycle-route-enter.strand) |

## See Combinations in Real Apps

- CRUD + Map + Option: [apps/04-issue-tracker](../examples/apps/04-issue-tracker/)
- Nested data + Kanban + theme: [apps/05-project-management](../examples/apps/05-project-management/)
