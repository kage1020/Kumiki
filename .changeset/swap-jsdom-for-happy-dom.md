---
"@kumikijs/cli": patch
---

Replace jsdom with happy-dom as the headless DOM behind `kumiki smoke` / `run` /
`test`. jsdom pulled ~40 transitive packages into every CLI install; happy-dom's
`GlobalRegistrator` provides the same DOM globals with a handful of dependencies
and also replaces the hand-rolled realm patching (Node's own `Event` /
`navigator` globals vs the DOM realm) that jsdom required. Verification behavior
is unchanged — the whole example corpus passes check + build + smoke + scenario
runs on the new environment.
