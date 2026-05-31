# Your First App — Counter

English · [日本語](./your-first-app.ja.md)

Build a working Counter by adding the 7 layers one at a time. The finished version is [examples/apps/01-counter/app.strand](https://github.com/kage1020/Strand/blob/main/examples/apps/01-counter/app.strand).

## 1. Declare State (slot)

```strand
slot count : Int = 0
```

A `slot` is mutable state. It has a type and an initial value.

## 2. Write Updates (reducer)

```strand
reducer inc on=ui.click(IncBtn) do= count := count + 1
```

`on=` is the event (here, a click on the tile `IncBtn`), and `do=` is the state update. `:=` is assignment.

## 3. Assemble the UI (tile)

```strand
tile IncBtn = button(text="+1", onClick=inc)
tile App    = column(heading("Count: " + count.show), IncBtn)
```

A `tile` is a UI component. `onClick=inc` binds the click to the reducer. `count.show` stringifies the number.

## 4. Tie It Together (app)

```strand
app Counter
    caps   = []
    routes = {"/" -> App, "/404" -> App}
    init   = []
```

`routes` must always include `/404` (otherwise [E0001](../spec/errors.md#e0001-missing-404)).

## 5. Check and Run

```sh
pnpm --filter @strand/cli exec tsx src/strand.ts check counter.strand
pnpm --filter @strand/cli exec tsx src/strand.ts build counter.strand ./out
```

## Going Further

- Constrain a value's range → nominal type + refinement ([examples/features/02-nominal-type.strand](https://github.com/kage1020/Strand/blob/main/examples/features/02-nominal-type.strand))
- Two-way binding with an input field → `bind` ([examples/features/13-text-input-bind.strand](https://github.com/kage1020/Strand/blob/main/examples/features/13-text-input-bind.strand))
- Render a list → `for ... in` ([examples/features/07-list.strand](https://github.com/kage1020/Strand/blob/main/examples/features/07-list.strand))

For the big picture of how to think about it, head to [Thinking in Strand](./thinking-in-strand.md).
