# Feature Catalog

English · [日本語](./README.ja.md)

Minimal examples, one feature per file. Each file is a self-contained, working Strand app, with parsing, type checking, and build verified in CI.

## Language core

| Example | Contents |
|---|---|
| [01-slot-and-reducer](./01-slot-and-reducer.strand) | The basic cycle of slot (state) + reducer (update) + tile (render) |
| [02-nominal-type](./02-nominal-type.strand) | nominal types and `between` refinement |
| [03-union-and-match](./03-union-and-match.strand) | union types and the `match` expression |
| [04-record-and-copy](./04-record-and-copy.strand) | record types and `.copy(field=value)` immutable update |
| [05-pure-fn](./05-pure-fn.strand) | pure functions `fn` (don't read slots) |
| [06-if-expression](./06-if-expression.strand) | `if ... then ... else` as a value |

## Collections and standard library

| Example | Contents |
|---|---|
| [07-list](./07-list.strand) | `List`'s `.map` / `.filter` / `for` |
| [08-map](./08-map.strand) | `Map`'s insert / get-or / keys |
| [09-set](./09-set.strand) | `Set`'s toggle / has |
| [10-option](./10-option.strand) | `Option`'s Some / None |
| [11-time-and-duration](./11-time-and-duration.strand) | `Time` / `Duration` arithmetic |
| [22-result](./22-result.strand) | `Result`'s Ok / Err and parsing |

## UI and style

| Example | Contents |
|---|---|
| [12-layout](./12-layout.strand) | column / row / grid and layout props |
| [13-text-input-bind](./13-text-input-bind.strand) | two-way `bind` for an input field |
| [14-select](./14-select.strand) | select with typed options |
| [15-checkbox](./15-checkbox.strand) | checkbox and disabled |
| [16-conditional-ui](./16-conditional-ui.strand) | conditional rendering with `when(...)` |
| [17-theme](./17-theme.strand) | theme tokens and dynamic theme switching |

## App level

| Example | Contents |
|---|---|
| [18-routing](./18-routing.strand) | path parameters, redirects, 404 |
| [19-effect-http](./19-effect-http.strand) | HTTP effect and the `latest` policy |
| [20-effect-storage](./20-effect-storage.strand) | localStorage persistence (once / debounce) |
| [21-timer](./21-timer.strand) | periodic execution with `timer(1s)` |
| [23-lifecycle-route-enter](./23-lifecycle-route-enter.strand) | `app.start` / `route.enter` |

New questions and bugs are answered first by adding a minimal reproduction here.
