# Pomodoro Timer — Kumiki Learning-Cost Measurement Task

English · [日本語](./task-spec.ja.md)

This task measures how accurately an LLM with only the Kumiki spec in its context
can write Kumiki code.

## Feature requirements

A Pomodoro timer SPA:

1. **Two modes**: `Work` (25 min = 1500 sec) and `Break` (5 min = 300 sec)
2. **slot `remaining`**: remaining seconds (integer, 0..1500)
3. **slot `mode`**: the current mode (variant `Work | Break`)
4. **slot `running`**: whether the timer is running (Bool)
5. **UI**:
   - Current mode display ("Work" or "Break")
   - Remaining-time display (shown in seconds; rendering as mm:ss later is desirable but not required)
   - `Start` button (starts if stopped)
   - `Pause` button (stops if running)
   - `Reset` button (resets the current mode to its maximum time and returns to the stopped state)
6. **Behavior**:
   - While running, `remaining` decreases by 1 every second
   - When `remaining` reaches 0, switch modes (Work → Break, Break → Work), reset to the new mode's maximum time, and keep running
7. **`app` declaration**: routes = `{"/" -> App, "/404" -> App}`, caps = `["timer"]` (or equivalent)

## Constraints

- The output is a single `.kumiki` file
- Do not mix in TypeScript / JavaScript / React syntax
- Do not call `setInterval` directly; use `effect timer`
- Once everything is written, write it out as a `.kumiki` file at the specified output path

## Evaluation

The output `.kumiki` is evaluated as follows:

| Stage | Criterion |
|---|---|
| Parse | Does `lexer + parser` not throw? |
| Typecheck | Does `kumiki check` return 0 errors? |
| Build | Can `kumiki build` generate `app.js`? |

LOC and token count are also recorded.
