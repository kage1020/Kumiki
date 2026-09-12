---
"@kumikijs/compiler": minor
---

Report a test-body section name the test kind does not have

A test body's sections are read by name — `slots`, `event`, `mocks`, `panic`,
`slots-equal` — and a name outside that set was read by nothing and reported by
nothing. The section simply did not happen, which does not weaken the test, it
replaces it:

```kumiki
test typo-section =
    reducer-test inc
        given  = {slot: {count: 41}, event: {type: ui.click, target: B}}
        expect = {slots: {count: 1}, effects: []}
```

```
check: ok
kumiki test: PASS  typo-section (1ms)
```

`slot` instead of `slots`, so the 41 never happens: `count` starts at its
declared `0`, `inc` makes it `1`, and the assertion holds against a state the
author did not choose.

That is E0714 now, at the key's own position and with the nearest accepted name
offered:

```
E0714 test-section-unknown at 9:19: Unknown section "slot" in a reducer-test
`given` — did you mean "slots"? (accepted: slots, event, mocks)
```

The accepted set is one table per kind and clause (`src/test-sections.ts`), and
`codegen/emit-test.ts` now reads every section through it — the section name it
asks for is typed from the table, so a section codegen reads and the checker
does not know about does not compile. The names *inside* an unknown section are
left unresolved: they belong to a section that does not exist, and reporting
them would name a second mistake at a position that stops existing once the
first is fixed.
