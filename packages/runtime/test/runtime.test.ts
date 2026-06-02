import type { AppShape } from "@kumikijs/runtime";
import { _stdlib, mount } from "@kumikijs/runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

// A named timer (`timer(100ms, name=countdown)`) incrementing `count`, plus a
// `stop` reducer that returns stopTimers: ["countdown"] (what codegen lowers
// `stop-timer(countdown)` to).
function makeTimerApp(): AppShape {
  const app: AppShape = {
    slots: { count: { value: 0 } },
    caps: [],
    effects: {},
    init: [],
    reducers: [
      {
        name: "tick",
        event: { kind: "timer", intervalMs: 100, name: "countdown" },
        apply: (live) => ({ slots: { count: (live.count as number) + 1 }, emits: [] }),
      },
      {
        name: "stop",
        selector: { tile: "StopBtn" },
        event: { kind: "ui", ev: "click" },
        apply: () => ({ slots: {}, emits: [], stopTimers: ["countdown"] }),
      },
    ],
    root: () => ({ kind: "column", children: [{ kind: "heading", text: "timer" }] }),
  };
  return app;
}

describe("named timers + stop-timer", () => {
  let root: HTMLElement;
  beforeEach(() => {
    vi.useFakeTimers();
    root = document.createElement("div");
    document.body.appendChild(root);
  });
  afterEach(() => {
    vi.useRealTimers();
    root.remove();
  });

  const count = (app: AppShape): unknown => (app.live as Record<string, unknown>).count;

  it("a named timer fires until stop-timer clears it", () => {
    const app = makeTimerApp();
    const { dispose } = mount(app, root);
    vi.advanceTimersByTime(350); // ticks at 100/200/300ms
    expect(count(app)).toBe(3);

    (app as unknown as { _dispatch: (n: string, el: Record<string, unknown>) => void })._dispatch(
      "stop",
      {},
    );
    const frozen = count(app);
    vi.advanceTimersByTime(500);
    expect(count(app)).toBe(frozen); // no further ticks after stop-timer
    dispose();
  });

  it("dispose clears a running named timer (no leak)", () => {
    const app = makeTimerApp();
    const { dispose } = mount(app, root);
    vi.advanceTimersByTime(150); // one tick
    expect(count(app)).toBe(1);
    dispose();
    vi.advanceTimersByTime(500);
    expect(count(app)).toBe(1); // disposed timer does not fire again
  });
});

// An overlay whose second child (the modal) is gated by the `open` slot —
// mirrors what codegen emits for `overlay(Content, when(open, Modal()))`.
function makeOverlayApp(): AppShape {
  const app: AppShape = {
    slots: { open: { value: false } },
    caps: [],
    effects: {},
    init: [],
    reducers: [
      {
        name: "toggle",
        selector: { tile: "Btn" },
        event: { kind: "ui", ev: "click" },
        apply: (live) => ({ slots: { open: !(live.open as boolean) }, emits: [] }),
      },
    ],
    root: () => {
      const open = (app.live as Record<string, unknown>).open as boolean;
      return {
        kind: "overlay",
        props: { align: "top" },
        children: [
          {
            kind: "column",
            props: {},
            children: [
              { kind: "heading", text: "Base" },
              {
                kind: "button",
                text: "toggle",
                props: {
                  onClick: () =>
                    (
                      app as unknown as {
                        _dispatch: (n: string, el: Record<string, unknown>) => void;
                      }
                    )._dispatch("toggle", {}),
                },
              },
            ],
          },
          open ? { kind: "card", props: {}, children: [{ kind: "text", text: "Modal" }] } : null,
        ],
      };
    },
  };
  return app;
}

describe("overlay builtin", () => {
  let root: HTMLElement;
  beforeEach(() => {
    root = document.createElement("div");
    document.body.appendChild(root);
  });
  afterEach(() => {
    root.remove();
  });

  const clickToggle = (r: HTMLElement): void => {
    Array.from(r.querySelectorAll("button"))
      .find((b) => b.textContent === "toggle")
      ?.click();
  };

  it("stacks layers: base in flow, overlay absolutely positioned by align; when toggles it", () => {
    const app = makeOverlayApp();
    mount(app, root);

    const overlay = root.querySelector('[data-kumiki-tile="overlay"]') as HTMLElement;
    expect(overlay).toBeTruthy();
    expect(overlay.style.position).toBe("relative");
    // closed: base is present, no overlay layer yet
    expect(overlay.textContent).toContain("Base");
    expect(root.querySelector('[data-kumiki-tile="overlay-layer"]')).toBeNull();

    // open: overlay layer mounts, absolutely positioned, aligned to top
    clickToggle(root);
    const layer = root.querySelector('[data-kumiki-tile="overlay-layer"]') as HTMLElement;
    expect(layer).toBeTruthy();
    expect(layer.style.position).toBe("absolute");
    expect(layer.style.alignItems).toBe("flex-start"); // align "top"
    expect(layer.style.justifyContent).toBe("center");
    expect(layer.textContent).toContain("Modal");
    // base layer unaffected
    const overlay2 = root.querySelector('[data-kumiki-tile="overlay"]') as HTMLElement;
    expect(overlay2.textContent).toContain("Base");

    // close: overlay layer unmounts, base remains
    clickToggle(root);
    expect(root.querySelector('[data-kumiki-tile="overlay-layer"]')).toBeNull();
    expect(
      (root.querySelector('[data-kumiki-tile="overlay"]') as HTMLElement).textContent,
    ).toContain("Base");
  });
});

describe("in-language test runner helpers", () => {
  it("runReducerTest passes when slots + effects match", () => {
    const r = _stdlib.runReducerTest({
      name: "t",
      givenSlots: { count: 0 },
      result: { slots: { count: 1 }, emits: [] },
      panic: null,
      expect: { kind: "state", slots: { count: 1 }, effects: [] },
    });
    expect(r.pass).toBe(true);
  });

  it("runReducerTest reports the diff path on a slot mismatch", () => {
    const r = _stdlib.runReducerTest({
      name: "t",
      givenSlots: { count: 0 },
      result: { slots: { count: 1 }, emits: [] },
      panic: null,
      expect: { kind: "state", slots: { count: 2 }, effects: [] },
    });
    expect(r.pass).toBe(false);
    expect(r.diffAt).toBe("slots.count");
  });

  it("runReducerTest compares emitted effect names", () => {
    const r = _stdlib.runReducerTest({
      name: "t",
      givenSlots: {},
      result: { slots: {}, emits: [{ effect: "persist", args: [] }] },
      panic: null,
      expect: { kind: "state", slots: {}, effects: [] },
    });
    expect(r.pass).toBe(false);
    expect(r.diffAt).toBe("effects.length");
  });

  it("runReducerTest matches an expected panic by substring", () => {
    expect(
      _stdlib.runReducerTest({
        name: "t",
        givenSlots: {},
        result: null,
        panic: "draft cannot be empty",
        expect: { kind: "panic", message: "cannot be empty" },
      }).pass,
    ).toBe(true);
  });

  it("runTileTest compares structure, ignoring props and handlers", () => {
    const actual = {
      kind: "column",
      children: [{ kind: "button", text: "+1", props: { onClick: () => undefined } }],
    };
    const expected = { kind: "column", children: [{ kind: "button", text: "+1", props: {} }] };
    expect(_stdlib.runTileTest({ name: "t", actual, expected }).pass).toBe(true);

    const mismatch = { kind: "column", children: [{ kind: "button", text: "-1" }] };
    const res = _stdlib.runTileTest({ name: "t", actual: mismatch, expected });
    expect(res.pass).toBe(false);
    expect(res.diffAt).toContain("text");
  });

  it("resetLive clears, seeds defaults, then applies given", () => {
    const live: Record<string, unknown> = { stale: 1 };
    _stdlib.resetLive(live, { count: { value: 0 }, name: { value: "x" } }, { count: 5 });
    expect(live).toEqual({ count: 5, name: "x" });
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
