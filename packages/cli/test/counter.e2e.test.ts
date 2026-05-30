import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mount } from "@strand/runtime";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildAndLoad } from "./helpers/build-and-load.ts";

const here = dirname(fileURLToPath(import.meta.url));
const COUNTER = resolve(here, "../../../examples/apps/01-counter/app.strand");

describe("counter e2e (built from .strand)", () => {
  let root: HTMLElement;
  const rootId = "counter-root";

  beforeEach(() => {
    root = document.createElement("div");
    root.id = rootId;
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.removeChild(root);
  });

  it("renders Count: 0 and three buttons", async () => {
    const app = await buildAndLoad(COUNTER, rootId);
    mount(app, root);
    expect(root.querySelector("h1")?.textContent).toBe("Count: 0");
    const buttons = Array.from(root.querySelectorAll("button"));
    expect(buttons.map((b) => b.textContent)).toEqual(["-", "reset", "+"]);
  });

  it("increments on + click", async () => {
    const app = await buildAndLoad(COUNTER, rootId);
    mount(app, root);
    const plus = Array.from(root.querySelectorAll("button")).find((b) => b.textContent === "+");
    plus?.click();
    expect(root.querySelector("h1")?.textContent).toBe("Count: 1");
    plus?.click();
    plus?.click();
    expect(root.querySelector("h1")?.textContent).toBe("Count: 3");
  });

  it("decrements but refinement rejects below 0", async () => {
    const app = await buildAndLoad(COUNTER, rootId);
    mount(app, root);
    const minus = Array.from(root.querySelectorAll("button")).find((b) => b.textContent === "-");
    minus?.click();
    expect(root.querySelector("h1")?.textContent).toBe("Count: 0");
  });

  it("resets to 0", async () => {
    const app = await buildAndLoad(COUNTER, rootId);
    mount(app, root);
    const buttons = Array.from(root.querySelectorAll("button"));
    const plus = buttons.find((b) => b.textContent === "+");
    const reset = buttons.find((b) => b.textContent === "reset");
    plus?.click();
    plus?.click();
    plus?.click();
    reset?.click();
    expect(root.querySelector("h1")?.textContent).toBe("Count: 0");
  });

  it("caps at refinement ceiling 999", async () => {
    const app = await buildAndLoad(COUNTER, rootId);
    mount(app, root);
    const plus = Array.from(root.querySelectorAll("button")).find((b) => b.textContent === "+");
    for (let i = 0; i < 1010; i++) plus?.click();
    expect(root.querySelector("h1")?.textContent).toBe("Count: 999");
  });
});
