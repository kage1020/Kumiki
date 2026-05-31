// Public API of @kumiki/e2e — the real-browser (Playwright) verification tier.
export {
  type Action,
  type BrowserOptions,
  type BrowserReport,
  type Expect,
  runScenarioInBrowser,
  type Scenario,
  type ScenarioStep,
  type StepResult,
} from "./browser.ts";
