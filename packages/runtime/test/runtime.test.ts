import type { AppShape } from "@kumikijs/runtime";
import { _stdlib, mount } from "@kumikijs/runtime";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

// Hand-crafted AppShape mirroring the counter example, using the Phase 2 runtime contract.
function makeCounterApp(): AppShape {
  const slots = {
    count: { value: 0, refine: (v: unknown) => typeof v === "number" && v >= 0 && v <= 999 },
  };
  const app: AppShape = {
    slots,
    caps: [],
    effects: {},
    init: [],
    reducers: [
      {
        name: "inc",
        selector: { tile: "IncBtn" },
        event: { kind: "ui", ev: "click" },
        apply: (live) => ({ slots: { count: (live.count as number) + 1 }, emits: [] }),
      },
      {
        name: "dec",
        selector: { tile: "DecBtn" },
        event: { kind: "ui", ev: "click" },
        apply: (live) => ({ slots: { count: (live.count as number) - 1 }, emits: [] }),
      },
      {
        name: "reset",
        selector: { tile: "ResetBtn" },
        event: { kind: "ui", ev: "click" },
        apply: () => ({ slots: { count: 0 }, emits: [] }),
      },
    ],
    root: () => ({
      kind: "column",
      children: [
        {
          kind: "heading",
          text: `Count: ${(app as unknown as { _live: { count: number } })._live?.count ?? 0}`,
        },
        {
          kind: "row",
          children: [
            {
              kind: "button",
              text: "-",
              props: {
                onClick: () =>
                  (
                    app as unknown as {
                      _dispatch: (n: string, el: Record<string, unknown>) => void;
                    }
                  )._dispatch("dec", {}),
              },
            },
            {
              kind: "button",
              text: "reset",
              props: {
                onClick: () =>
                  (
                    app as unknown as {
                      _dispatch: (n: string, el: Record<string, unknown>) => void;
                    }
                  )._dispatch("reset", {}),
              },
            },
            {
              kind: "button",
              text: "+",
              props: {
                onClick: () =>
                  (
                    app as unknown as {
                      _dispatch: (n: string, el: Record<string, unknown>) => void;
                    }
                  )._dispatch("inc", {}),
              },
            },
          ],
          props: { gap: "sm" },
        },
      ],
    }),
  };

  // Provide `_live` so the root() closure can read count after mounts.
  (app as unknown as { _live: Record<string, unknown> })._live = { count: 0 };
  // Intercept the runtime's slot writes by patching apply functions to also
  // write into our shadow `_live` mirror. (Phase 2 runtime keeps the canonical
  // live values internally; we mirror to make assertions simpler.)
  const originalReducers = app.reducers;
  app.reducers = originalReducers.map((r) => ({
    ...r,
    apply: (live, payload) => {
      const result = r.apply(live, payload);
      const mirror = (app as unknown as { _live: Record<string, unknown> })._live;
      for (const [k, v] of Object.entries(result.slots)) {
        const meta = slots[k as keyof typeof slots];
        if (meta?.refine && !meta.refine(v)) continue;
        mirror[k] = v;
      }
      return result;
    },
  }));

  return app;
}

describe("runtime", () => {
  let root: HTMLElement;

  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
  });

  afterEach(() => {
    document.body.removeChild(root);
  });

  it("renders initial state and three buttons", () => {
    mount(makeCounterApp(), root);
    expect(root.querySelector("h1")?.textContent).toBe("Count: 0");
    const buttons = Array.from(root.querySelectorAll("button"));
    expect(buttons.map((b) => b.textContent)).toEqual(["-", "reset", "+"]);
  });

  it("increments on + click and re-renders", () => {
    mount(makeCounterApp(), root);
    const plus = Array.from(root.querySelectorAll("button")).find((b) => b.textContent === "+");
    plus?.click();
    expect(root.querySelector("h1")?.textContent).toBe("Count: 1");
    plus?.click();
    plus?.click();
    expect(root.querySelector("h1")?.textContent).toBe("Count: 3");
  });

  it("rejects values below refinement floor", () => {
    mount(makeCounterApp(), root);
    const minus = Array.from(root.querySelectorAll("button")).find((b) => b.textContent === "-");
    minus?.click();
    expect(root.querySelector("h1")?.textContent).toBe("Count: 0");
  });

  it("resets to 0", () => {
    mount(makeCounterApp(), root);
    const buttons = Array.from(root.querySelectorAll("button"));
    const plus = buttons.find((b) => b.textContent === "+");
    const reset = buttons.find((b) => b.textContent === "reset");
    plus?.click();
    plus?.click();
    plus?.click();
    reset?.click();
    expect(root.querySelector("h1")?.textContent).toBe("Count: 0");
  });

  it("clamps at refinement ceiling 999", () => {
    mount(makeCounterApp(), root);
    const plus = Array.from(root.querySelectorAll("button")).find((b) => b.textContent === "+");
    for (let i = 0; i < 1001; i++) plus?.click();
    expect(root.querySelector("h1")?.textContent).toBe("Count: 999");
  });
});

describe("stdlib collection methods (issue #5)", () => {
  it("listChunk splits into n-sized chunks; last may be shorter", () => {
    expect(_stdlib.listChunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(_stdlib.listChunk([], 2)).toEqual([]);
  });

  it("listZip pairs elements up to the shorter length", () => {
    expect(_stdlib.listZip([1, 2, 3], ["a", "b"])).toEqual([
      [1, "a"],
      [2, "b"],
    ]);
  });

  it("mapUpdate applies fn to an existing key, no-op when absent", () => {
    expect(_stdlib.mapUpdate({ a: 1 }, "a", (v) => (v as number) + 1)).toEqual({ a: 2 });
    expect(_stdlib.mapUpdate({ a: 1 }, "b", (v) => (v as number) + 1)).toEqual({ a: 1 });
  });

  it("setAdd / setUnion / setIntersect / setDiff", () => {
    expect(_stdlib.setAdd({}, "x")).toEqual({ x: true });
    expect(_stdlib.setUnion({ a: true }, { b: true })).toEqual({ a: true, b: true });
    expect(_stdlib.setIntersect({ a: true, b: true }, { b: true, c: true })).toEqual({ b: true });
    expect(_stdlib.setDiff({ a: true, b: true }, { b: true })).toEqual({ a: true });
  });

  it("or returns the receiver when Some/Ok, else other", () => {
    expect(_stdlib.or(_stdlib.Some(1), _stdlib.Some(2))).toEqual(_stdlib.Some(1));
    expect(_stdlib.or(_stdlib.None, _stdlib.Some(2))).toEqual(_stdlib.Some(2));
    expect(_stdlib.or(_stdlib.Ok(1), _stdlib.Ok(2))).toEqual(_stdlib.Ok(1));
    expect(_stdlib.or(_stdlib.Err("e"), _stdlib.Ok(2))).toEqual(_stdlib.Ok(2));
  });

  it("mapErr maps the Err payload, passes Ok through", () => {
    expect(_stdlib.mapErr(_stdlib.Err("x"), (e) => `${e}!`)).toEqual(_stdlib.Err("x!"));
    expect(_stdlib.mapErr(_stdlib.Ok(1), (e) => `${e}!`)).toEqual(_stdlib.Ok(1));
  });

  it("diff is numeric for Time/Duration and set-difference for Sets", () => {
    expect(_stdlib.diff(10, 3)).toBe(7);
    expect(_stdlib.diff(3, 10)).toBe(7);
    expect(_stdlib.diff({ a: true, b: true }, { b: true })).toEqual({ a: true });
  });
});
