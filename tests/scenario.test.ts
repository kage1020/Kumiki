// Validates the scenario runner — the substrate for an agent's autonomous
// generate → run → observe → fix loop. Drives real examples by reducer name and
// by clicking text, and asserts on reliable slot state (not scraped pixels).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runScenario, type Scenario } from "@kumikijs/runtime";
import { describe, expect, it } from "vitest";
import { loadApp } from "./helpers/load.ts";

const here = dirname(fileURLToPath(import.meta.url));
const examples = join(here, "..", "examples");
const counter = join(examples, "features", "01-slot-and-reducer.kumiki");

function freshRoot(): HTMLElement {
  const root = document.createElement("div");
  document.body.appendChild(root);
  return root;
}

describe("scenario runner", () => {
  it("drives a reducer by name and asserts slot state", async () => {
    const app = await loadApp(counter);
    const report = await runScenario(app, freshRoot(), {
      steps: [
        { do: { dispatch: "inc" }, expect: { noErrors: true, state: { count: 1 } } },
        { do: { dispatch: "inc" }, expect: { state: { count: 2 } } },
      ],
    });
    expect(report.ok).toBe(true);
    expect(report.steps[1]?.state.count).toBe(2);
  });

  it("drives the UI by visible text", async () => {
    const app = await loadApp(counter);
    const report = await runScenario(app, freshRoot(), {
      steps: [
        { do: { clickText: "+1" }, expect: { state: { count: 1 }, domIncludes: ["Count: 1"] } },
      ],
    });
    expect(report.ok).toBe(true);
  });

  it("reports assertion failures with detail instead of throwing", async () => {
    const app = await loadApp(counter);
    const report = await runScenario(app, freshRoot(), {
      steps: [{ do: { dispatch: "inc" }, expect: { state: { count: 99 } } }],
    });
    expect(report.ok).toBe(false);
    expect(report.steps[0]?.failures[0]).toContain("count");
  });

  // A manifest-registered custom capability (telemetry.track) must compile and
  // its effect must be emittable + dispatched — mocked deterministically here,
  // exactly like a standard effect. loadApp resolves examples/features/kumiki.caps.json.
  it("dispatches a manifest-registered custom effect (mocked deterministically)", async () => {
    const app = await loadApp(join(examples, "features", "27-custom-capability.kumiki"));
    const report = await runScenario(app, freshRoot(), {
      steps: [
        { do: { clickText: "Track" }, expect: { noErrors: true, state: { sent: 1 } } },
        { do: { clickText: "Track" }, expect: { state: { sent: 2 } } },
      ],
      effects: { track: [{ outcome: "ok" }, { outcome: "ok" }] },
    });
    expect(report.ok).toBe(true);
  });

  // Regression: this app's scenario guards two framework fixes found via the
  // iterate loop — List.fold codegen, and Int.parse numeric coercion (a total
  // that was silently wrong via string concatenation).
  it("runs the expense-tracker acceptance scenario (fold + Int.parse)", async () => {
    const dir = join(examples, "apps", "06-expenses");
    const app = await loadApp(join(dir, "app.kumiki"));
    const scenario = JSON.parse(readFileSync(join(dir, "scenario.json"), "utf8")) as Scenario;
    const report = await runScenario(app, freshRoot(), scenario);
    if (!report.ok) {
      const detail = report.steps
        .flatMap((s, i) => [...s.errors, ...s.failures].map((m) => `step ${i}: ${m}`))
        .join("\n");
      throw new Error(`expense scenario failed:\n${detail}`);
    }
    expect(report.ok).toBe(true);
  });
});
