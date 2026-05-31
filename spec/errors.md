# Error Code Specification

English · [日本語](./errors.ja.md)

The diagnostics reported by the Strand compiler (`@strand/compiler`) split into two families: **parse errors** and **type-check errors**. This document enumerates both normatively. If a code is added or changed on the implementation side, this document must be updated at the same time.

## The Form of an Error

A type-check error is represented as a `StrandError`:

```ts
type StrandError = {
  code: string;   // a stable identifier such as "E0103"
  kind: string;   // a machine-readable classification such as "undef-slot"
  message: string; // a human-facing message (includes the target name)
  pos: Pos;        // { line, col }
};
```

`code` is a permanent contract; once assigned, its meaning does not change. `kind` is a sub-classification under the same `code`, used to branch diagnostic logic.

A parse error is `throw`n as a `ParseError` (`message` + `pos`). Because the parse stage stops at the first error, no code is assigned.

## The Code System

| Band | Domain |
|---|---|
| `E00xx` | App structure (such as mandatory routing requirements) |
| `E01xx` | Name resolution (undefined references) |
| `E02xx` | Type mismatch |
| `E03xx` | Capabilities and purity |
| `E06xx` | reducer write rules |
| `E07xx` | Accessibility (a11y) |
| `E08xx` | Runtime hazards (code that compiles but breaks at runtime) |

## E00xx — Structure

### E0001 `missing-404`

An app that declares `app.routes` must include a route for the `/404` pattern. Unmatched paths fall back here.

> `app.routes must include a "/404" entry`

**Fix**: Add a route to a 404 tile, such as `route "/404" -> NotFound`. See [./routing.md](./routing.md) for details.

## E01xx — Name Resolution

### E0102 `undef-reducer`

An event handler argument / prop refers to a reducer name that does not exist.

> `Reference to undefined reducer "<name>"`

**Fix**: Check the spelling of the reducer name. `strand fix` can suggest a close name (→ [./ai-edit.md](./ai-edit.md)).

### E0103 `undef-ref` / `undef-slot`

- `undef-ref`: An undefined name was referenced in an expression.
  > `Reference to undefined name "<name>"`
- `undef-slot`: An assignment was made to an undefined slot in a reducer body.
  > `Assignment to undefined slot "<name>"`

**Fix**: Confirm that the referenced slot / binding is declared.

### E0104 `undef-effect`

The target of an `emit` refers to an undefined effect.

> `Reference to undefined effect "<name>"`

### E0105 `undef-tile`

A tile reference, or the target of a route definition, refers to an undefined tile.

> `Reference to undefined tile "<name>"`
> `Route "<path>" targets undefined tile "<name>"`

## E02xx — Types

### E0201 `type-mismatch`

An event handler argument / prop must be a reducer name, but was a different kind of value.

> `Event handler arg "<name>" must be a reducer name`
> `Event handler prop "<name>" must be a reducer name`

## E03xx — Capabilities and Purity

### E0301 `missing-capability`

A capability required by an effect is not declared in `app.caps`.

> `Effect "<effect>" requires capability "<cap>" which is not declared in app.caps`

**Fix**: Add the required capability to `app.caps`. For details on the capability model, see [./lifecycle.md](./lifecycle.md).

### E0305 `fn-impurity`

A `fn` (pure function) is reading a slot. A `fn` must depend only on its arguments.

> `fn "<name>" must not read slot "<name>"`

**Fix**: Pass the required slot value as an argument.

## E06xx — reducer Write Rules

### E0601 `duplicate-write`

Within the same reducer, the same slot path shape (lvalue shape) is written more than once. This violates the one-write-per-reducer rule (at path-shape granularity).

> `Slot path "<shape>" is written more than once in this reducer`

**Note**: The granularity is **path shape**. `issues[id].status` and `issues[id].updatedAt` are considered different shapes and can coexist, but double assignment to `count` is forbidden. For the rationale, see [../design-notes/rationale.md](../design-notes/rationale.md).

## E07xx — Accessibility (a11y)

a11y checking is enabled via `check(program, { strictA11y: true })`.

### E0701 `a11y-button`

> `button must have a text= argument or aria-label prop`

### E0702 `a11y-image`

> `image must have an alt prop`

### E0703 `a11y-link`

> `link must have inner text or aria-label`

**Fix**: Provide visible text, or an `aria-label` / `alt`. For general guidance on forms, see [./forms.md](./forms.md).

## E08xx — Runtime Hazards

A band for statically catching, at the `check` stage, "code" that passes type checking but breaks at runtime. For the three-layer verification model, see [./testing.md](./testing.md) §8.10.

### E0801 `unimplemented-method`

A method call of the form `obj.method(...)` does not exist in the set of methods implemented by the runtime / code generation. This occurs from a misspelling (`.fitler`), a method that appears in the specification but is unimplemented, or misuse of a method from a different type (such as `.to-result` on `Option`).

> `Method ".<name>" is not implemented by the runtime`

**Note**: The set of implemented methods is solely authoritative in `@strand/compiler`'s `KNOWN_METHODS` (kept in sync with code generation's `methodCallJs`). Calling a no-argument method with `()` is also caught by this band. For the list of standard library methods, see [./stdlib.md](./stdlib.md).

**Fix**: Correct it to the right method name, or rewrite the operation using implemented means such as `match` / `fold`. If you need an unimplemented specification method, implement it in `packages/` and add a working example in `examples/`.
