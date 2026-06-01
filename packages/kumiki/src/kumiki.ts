#!/usr/bin/env node
// The `kumiki` command is a thin entry point. The actual CLI lives in
// @kumikijs/cli; importing its `./kumiki` subpath runs the command (argv is read
// at module load). This package exists so `npx kumiki` / `npm i -g kumiki`
// work without the @scope prefix; library users install @kumikijs/* directly.
import "@kumikijs/cli/kumiki";
