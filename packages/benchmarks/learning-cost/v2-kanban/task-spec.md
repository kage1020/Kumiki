# Kanban Board — Kumiki Learning-Cost Measurement Task v2

English · [日本語](./task-spec.ja.md)

A mid-sized SPA that measures how accurately an LLM can write Kumiki. More complex than Pomodoro (an estimated 150–250 LOC).

## Feature requirements

A three-column Kanban board SPA:

1. **Three columns**: `Todo` / `Doing` / `Done`
2. **type Column = Todo | Doing | Done**
3. **type Card**: `{id: CardId, title: Text, column: Column, createdAt: Time}`
4. **slot cards**: `Map(CardId, Card) = {}`
5. **slot draft**: `Text = ""` (input field for a new card)
6. **UI**:
   - Top: input + Add button (enabled when draft is non-empty; adds the draft card to the Todo column)
   - Lay out the three columns (Todo / Doing / Done) side by side
   - Each column header: column name + count (e.g., "Todo (3)")
   - Card within each column: title + arrow buttons (← →) + delete button (✕)
   - ← moves to the previous column, → to the next column (disabled at the ends)
7. **Behavior**:
   - addCard: draft is non-empty → add a new card to the Todo column, clear draft
   - moveLeft / moveRight: move the given card to the adjacent column
   - deleteCard: delete the given card
8. **Persistence**: save and restore cards in localStorage
9. **theme**: reasonable styling (gap / pad / color)

## Constraints

- The output is a single `.kumiki` file
- Do not mix in TypeScript / JSX
- Express side effects with effects
- Specify routes/caps explicitly in the `app` declaration

## Output

Write it out as a `.kumiki` file at the specified path.

## Evaluation

With `benchmarks/learning-cost/eval.mjs`:
- Does it pass parse?
- Does it pass typecheck?
- Does it pass build?
- Record LOC and token count
