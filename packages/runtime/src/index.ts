// Kumiki v0.1 runtime — Phase 3 browser runtime.

export {
  type AttributeSlotBinding,
  defineKumikiElement,
  type KumikiElementOptions,
} from "./element.ts";
export {
  type Action,
  type EffectScript,
  type Expect,
  runScenario,
  type Scenario,
  type ScenarioReport,
  type ScenarioStep,
  type StepResult,
} from "./scenario.ts";
export {
  type SmokeIssue,
  type SmokeOptions,
  type SmokePhase,
  type SmokeReport,
  smoke,
} from "./smoke.ts";

export type RefinementCheck = (v: unknown) => boolean;
export type EventHandler = (el: Record<string, unknown>) => void;

/**
 * A controlled panic — Kumiki's "stop the program" signal (docs/spec/stdlib.md §2.2:
 * `panic(message)`; `Option/Result.get` on the empty case; `Result.get-err` on
 * `Ok`). On the live path a panic is caught — the dispatch episode is rolled
 * back (no partial slot writes) and an error boundary / top-level fallback is
 * shown — instead of escaping the DOM event handler / render uncaught. The
 * reducer-test harness already catches it to power `expect = {panic: ...}`.
 */
export class KumikiPanic extends Error {
  readonly isKumikiPanic = true as const;
  readonly location: string | undefined;
  constructor(message: string, location?: string) {
    super(message);
    this.name = "KumikiPanic";
    this.location = location;
  }
}

/** True for a KumikiPanic — also matches across realms where `instanceof` fails. */
function isPanic(e: unknown): e is KumikiPanic {
  return (
    e instanceof KumikiPanic ||
    (typeof e === "object" &&
      e !== null &&
      (e as { isKumikiPanic?: boolean }).isKumikiPanic === true)
  );
}

export type TileNode =
  | { kind: "page" | "column" | "row" | "card" | "box"; children: TileNode[]; props?: TileProps }
  | { kind: "heading" | "text"; text: string; props?: TileProps }
  | { kind: "button"; text: string; props?: TileProps; loading?: boolean; disabled?: boolean }
  | {
      kind: "input";
      props?: TileProps;
      bind?: string;
      bindPath?: string[];
      value?: string;
      type?: string;
      placeholder?: string;
      required?: boolean;
      autoFocus?: boolean;
      id?: string;
    }
  | {
      kind: "textarea";
      props?: TileProps;
      bind?: string;
      bindPath?: string[];
      value?: string;
      rows?: number;
      placeholder?: string;
      id?: string;
    }
  | { kind: "check"; checked: boolean; props?: TileProps }
  | { kind: "spinner"; props?: TileProps }
  | { kind: "skeleton"; props?: TileProps }
  | { kind: "form"; children: TileNode[]; props?: TileProps }
  | { kind: "label"; text: string; props?: TileProps }
  | { kind: "link"; text: string; to: string; props?: TileProps }
  | { kind: "markdown"; text: string; props?: TileProps }
  | { kind: "image"; src: string; props?: TileProps }
  | { kind: "icon"; name: string; props?: TileProps }
  | {
      kind: "select";
      props?: TileProps;
      bind?: string;
      bindPath?: string[];
      value?: unknown;
      options?: Array<{ label: unknown; value: unknown }>;
      placeholder?: string;
    }
  | { kind: "radio"; props?: TileProps; group?: string; value?: unknown; selected?: boolean }
  | {
      kind: "grid" | "stack" | "region" | "scroll" | "panel" | "fieldset" | "overlay";
      children: TileNode[];
      props?: TileProps;
    }
  | { kind: "divider"; props?: TileProps };

export type TileProps = Record<string, unknown> & {
  onClick?: EventHandler;
  onSubmit?: EventHandler;
  onChange?: EventHandler;
  onInput?: EventHandler;
  el?: Record<string, unknown>;
};

export type SlotMeta = { value: unknown; refine?: RefinementCheck; volatile?: boolean };

export type ReducerSpec = {
  name: string;
  selector?: { tile: string; id?: string };
  event:
    | { kind: "ui"; ev: "click" | "submit" | "change" | "input" }
    | { kind: "effect"; effect: string; outcome: "ok" | "err" }
    | { kind: "timer"; intervalMs: number; name?: string }
    | { kind: "lifecycle"; name: string };
  apply: (
    slots: Record<string, unknown>,
    payload: Record<string, unknown>,
  ) => { slots: Record<string, unknown>; emits: EmitSpec[]; stopTimers?: string[] };
};

export type EmitSpec = { effect: string; args: unknown[] };

export type EffectSpec = {
  name: string;
  cap: string;
  policy?:
    | { kind: "latest" }
    | { kind: "latest-per-key"; keyOf: (input: unknown) => string }
    | { kind: "queue" }
    | { kind: "debounce"; ms: number }
    | { kind: "throttle"; ms: number }
    | { kind: "once" };
  invoke: (input: unknown, caps: CapabilityRegistry) => Promise<EffectResult>;
};

export type EffectResult = { kind: "ok"; value: unknown } | { kind: "err"; value: unknown };

/**
 * A host-supplied implementation for a custom capability (one registered via
 * `kumiki.caps.json`). This is Kumiki's inbound ecosystem seam: arbitrary JS /
 * npm libraries live here, behind a typed, mockable capability boundary, so the
 * Kumiki core stays pure (no language-level FFI). `input` is the effect's
 * (already `map-request`-mapped) request; the return may be sync or async.
 */
export type CapabilityProvider = (
  input: unknown,
  caps: CapabilityRegistry,
) => Promise<EffectResult> | EffectResult;

export type CapabilityRegistry = {
  has(cap: string): boolean;
  /** The host provider registered for `cap` at mount, or undefined. */
  provider(cap: string): CapabilityProvider | undefined;
};

/** Options accepted by `mount`. */
export type MountOptions = {
  /** Host implementations for custom capabilities, keyed by capability name. */
  providers?: Record<string, CapabilityProvider>;
  /**
   * Where Kumiki injects its `<style>` nodes (motion / theme / state styles).
   * Defaults to `document` (styles go in `<head>`). Pass a `ShadowRoot` to keep
   * them encapsulated — used by `defineKumikiElement({ shadow: true })`.
   */
  styleRoot?: Document | ShadowRoot;
  /**
   * The element whose inline style carries theme background/foreground/font
   * (the `<body>` equivalent). Defaults to `document.body`; the shadow element
   * passes its in-shadow container so theming stays encapsulated.
   */
  styleHost?: HTMLElement;
  /**
   * Routing source (#36). `"history"` (default) reads/writes the ambient
   * document `location` / `history`. `"memory"` holds the current path in
   * memory and never touches `history.*` — for embedded / sandboxed hosts (the
   * docs playground `srcdoc`, a Web Component) where the Kumiki app does not own
   * the top-level URL and `history.pushState` throws in an opaque origin.
   */
  router?: "history" | "memory";
  /** Initial path for the memory router (default `"/"`). Ignored in history mode. */
  initialPath?: string;
};

export type RouteEntry = {
  pattern: string;
  /** Returns the TileNode for this route given the current state. */
  tile: () => TileNode;
};

export type RedirectEntry = { pattern: string; redirectTo: string };

export type ThemeValue = string | number | { [k: string]: ThemeValue };
export type Theme = { [k: string]: ThemeValue };

export type AppShape = {
  slots: Record<string, SlotMeta>;
  caps: string[];
  reducers: ReducerSpec[];
  effects: Record<string, EffectSpec>;
  init: EmitSpec[];
  routes?: Array<RouteEntry | RedirectEntry>;
  http?: {
    baseUrl?: string;
    headers?: () => Record<string, string>;
    on401?: string;
    timeout?: number;
  };
  /** Phase 4: registered themes by name. */
  themes?: Record<string, Theme>;
  /** Phase 4: selected theme name. */
  themeName?: string | null;
  /** v0.2 M5: reusable scoped animations by name (closed-grammar keyframes + timing). */
  motions?: Record<string, unknown>;
  root?: () => TileNode;
  live?: Record<string, unknown>;
  _rerender?: () => void;
};

type ParsedRoute = {
  path: string;
  pattern: string;
  params: Record<string, string>;
  query: Record<string, string>;
  hash: string | null;
};

/** The slice of `Location` the routing path actually reads. */
type LocationLike = { pathname: string; search: string; hash: string };

/**
 * Routing source abstraction (#36). `historyRouter` drives the ambient document
 * `location` / `history`; `memoryRouter` holds the path in memory for embedded /
 * sandboxed hosts (playground `srcdoc`, Web Component) where the app does not
 * own the URL and `history.*` throws in an opaque origin.
 */
interface Router {
  read(): LocationLike;
  push(path: string): void;
  replace(path: string): void;
  back(): void;
  /** Subscribe to out-of-band location changes (browser back/forward). */
  subscribe(cb: () => void): () => void;
}

function historyRouter(): Router {
  return {
    read: () => ({ pathname: location.pathname, search: location.search, hash: location.hash }),
    push: (p) => history.pushState(null, "", p),
    replace: (p) => history.replaceState(null, "", p),
    back: () => history.back(),
    subscribe: (cb) => {
      const h = (): void => cb();
      window.addEventListener("popstate", h);
      return () => window.removeEventListener("popstate", h);
    },
  };
}

/** Split a raw path into the `{ pathname, search, hash }` parseLocation reads. */
function splitPath(p: string): LocationLike {
  let rest = p || "/";
  let hash = "";
  const hi = rest.indexOf("#");
  if (hi !== -1) {
    hash = rest.slice(hi);
    rest = rest.slice(0, hi);
  }
  let search = "";
  const qi = rest.indexOf("?");
  if (qi !== -1) {
    search = rest.slice(qi);
    rest = rest.slice(0, qi);
  }
  return { pathname: rest || "/", search, hash };
}

function memoryRouter(initialPath = "/"): Router {
  const stack: string[] = [initialPath || "/"];
  const listeners = new Set<() => void>();
  return {
    read: () => splitPath(stack[stack.length - 1] ?? "/"),
    push: (p) => {
      stack.push(p);
    },
    replace: (p) => {
      stack[stack.length - 1] = p;
    },
    back: () => {
      if (stack.length > 1) {
        stack.pop();
        for (const l of listeners) l();
      }
    },
    subscribe: (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
  };
}

function parseLocation(routes: AppShape["routes"], loc: LocationLike): ParsedRoute {
  const path = loc.pathname || "/";
  const query: Record<string, string> = {};
  const params = new URLSearchParams(loc.search);
  for (const [k, v] of params.entries()) query[k] = v;
  const hash = loc.hash ? loc.hash.slice(1) : null;
  if (!routes) return { path, pattern: path, params: {}, query, hash };
  // First pass: non-redirect routes.
  for (const r of routes) {
    if ("redirectTo" in r) continue;
    const m = matchPattern(r.pattern, path);
    if (m) return { path, pattern: r.pattern, params: m, query, hash };
  }
  // 404 fallback
  return { path, pattern: "/404", params: {}, query, hash };
}

function matchPattern(pattern: string, path: string): Record<string, string> | null {
  if (pattern === "/404") return null;
  const patSegs = pattern.split("/").filter(Boolean);
  const pathSegs = path.split("/").filter(Boolean);
  const params: Record<string, string> = {};
  // Wildcard `/*` matches everything from that point on.
  for (let i = 0; i < patSegs.length; i++) {
    const p = patSegs[i]!;
    if (p === "*") return params;
    const s = pathSegs[i];
    if (s === undefined) return null;
    if (p.startsWith(":")) {
      params[p.slice(1)] = decodeURIComponent(s);
    } else if (p !== s) {
      return null;
    }
  }
  if (pathSegs.length !== patSegs.length) return null;
  return params;
}

function emptyRoute(): ParsedRoute {
  return { path: "/", pattern: "/", params: {}, query: {}, hash: null };
}

export function mount(
  app: AppShape,
  target: HTMLElement,
  options: MountOptions = {},
): { dispose: () => void } {
  if (!app.live) {
    app.live = {};
    for (const [k, v] of Object.entries(app.slots)) app.live[k] = v.value;
  }
  // Ensure `route` slot exists (auto-managed by runtime when routes are declared).
  if (!("route" in app.live)) {
    app.live.route = emptyRoute();
  }
  // Route every <style> injection to the requested root (document head by
  // default, or a shadow root for an isolated Web Component). Reset the cached
  // state-style node so it is re-resolved into this mount's root.
  currentStyleRoot = options.styleRoot ?? document;
  currentStyleHost = options.styleHost ?? null;
  stateStylesEl = null;
  // Inject the app's `motion` keyframes (+ prefers-reduced-motion guard) once.
  ensureMotionStyles(app);
  const slotValues = app.live;

  // Routing source: ambient location/history by default, or an in-memory path
  // for embedded/sandboxed hosts that don't own the URL (#36).
  const router: Router =
    options.router === "memory" ? memoryRouter(options.initialPath) : historyRouter();
  let routerUnsub: (() => void) | undefined;

  const caps = makeCapabilityRegistry(app.caps, options.providers);
  const dispatcher = makeEffectDispatcher(app, caps, (effect, outcome, value, key) => {
    handleEffectResult(effect, outcome, value, key);
  });

  let currentRoot: HTMLElement | null = null;
  let disposed = false;
  // Named timers (`timer(d, name=N)`) are addressable so a reducer can
  // `stop-timer(N)`. Anonymous timers have no handle exposed to the app.
  const namedTimers = new Map<string, ReturnType<typeof setInterval>>();
  const anonTimers: ReturnType<typeof setInterval>[] = [];
  const render = (): void => {
    // Late effect results (e.g. an in-flight fetch that resolves after the app
    // was disposed) must not touch the DOM — `currentRoot` has already been
    // detached by dispose()'s `replaceChildren()`, so replaceChild would throw.
    if (disposed) return;
    type FocusSnap = {
      bind?: string | undefined;
      id?: string | undefined;
      path?: number[] | undefined;
      selStart: number | null;
      selEnd: number | null;
    } | null;
    let snap: FocusSnap = null;
    const active = document.activeElement;
    if (
      active &&
      (active.tagName === "INPUT" || active.tagName === "TEXTAREA") &&
      target.contains(active)
    ) {
      const el = active as HTMLInputElement;
      snap = {
        bind: el.dataset.kumikiBind ?? undefined,
        id: el.id || undefined,
        path: domPath(el, target),
        selStart: el.selectionStart,
        selEnd: el.selectionEnd,
      };
    }

    maybeReapplyTheme(app);
    let dom: HTMLElement;
    try {
      const tree = pickRootTile(app);
      dom = renderTile(tree);
    } catch (e) {
      // A render panic NOT caught by a per-tile `error-boundary` (e.g. one under
      // the root) lands here: render a top-level panic fallback instead of
      // letting the exception escape and leaving the DOM stale. Logged via
      // console.error so the smoke / scenario tiers still flag it (#24).
      reportPanic("render", e);
      dom = renderPanicFallback(e);
    }
    if (currentRoot) target.replaceChild(dom, currentRoot);
    else target.appendChild(dom);
    currentRoot = dom;

    if (snap) {
      let sel: Element | null = snap.bind
        ? target.querySelector(`[data-kumiki-bind="${snap.bind}"]`)
        : snap.id
          ? target.querySelector(`#${CSS.escape(snap.id)}`)
          : null;
      // Fall back to DOM-path restore for inputs without bind/id (e.g.
      // `value=`-only search boxes). Identifies the element by its position.
      if (!sel && snap.path) sel = elementAtPath(snap.path, target);
      if (sel && (sel.tagName === "INPUT" || sel.tagName === "TEXTAREA")) {
        const el = sel as HTMLInputElement;
        el.focus();
        if (snap.selStart !== null && snap.selEnd !== null) {
          try {
            el.setSelectionRange(snap.selStart, snap.selEnd);
          } catch {
            // some input types don't support selection
          }
        }
      }
    }
  };

  function pickRootTile(app: AppShape): TileNode {
    if (app.routes && app.routes.length > 0) {
      const cur = slotValues.route as ParsedRoute;
      for (const r of app.routes) {
        if (r.pattern === cur.pattern && "tile" in r) return r.tile();
      }
      // 404 fallback tile
      for (const r of app.routes) {
        if (r.pattern === "/404" && "tile" in r) return r.tile();
      }
    }
    return app.root ? app.root() : { kind: "text", text: "(no root)" };
  }

  // Re-entrancy guard so a panic inside the `app.error` handler itself does not
  // recurse — it is just logged.
  let inPanicHandler = false;

  /**
   * Handle a caught live panic per docs/spec/lifecycle.md §7.2: the dispatch episode
   * is already rolled back (the caller never applied the failed result), so we
   * surface it (console.error → smoke/scenario see it) and fire the `app.error`
   * reducer(s) with `$event = PanicInfo`, exactly as §7.2.3 specifies.
   */
  function handleLivePanic(location: string, e: unknown): void {
    reportPanic(location, e);
    if (inPanicHandler) return;
    const handlers = app.reducers.filter(
      (h) => h.event.kind === "lifecycle" && h.event.name === "app.error",
    );
    if (handlers.length === 0) return;
    const info = { message: panicInfo(e).message, location };
    inPanicHandler = true;
    try {
      for (const h of handlers) applyReducer(h, { $event: info });
    } finally {
      inPanicHandler = false;
    }
  }

  function applyReducer(r: ReducerSpec, payload: Record<string, unknown>): void {
    if (disposed) return;
    let result: ReturnType<ReducerSpec["apply"]>;
    try {
      result = r.apply(slotValues, payload);
    } catch (e) {
      // A panic (or any throw) inside a reducer is caught here so it does not
      // escape the DOM event handler. The dispatch episode is rolled back —
      // `apply` returns the new slots and we only write them on success, so a
      // throw applies NO partial state. The app stays interactive (a later
      // dispatch still runs); the `app.error` reducer (if any) is fired with
      // PanicInfo. The reducer-test harness catches panics separately (#24).
      handleLivePanic(`reducer "${r.name}"`, e);
      return;
    }
    for (const [k, v] of Object.entries(result.slots)) {
      const meta = app.slots[k];
      if (meta?.refine && !meta.refine(v)) continue;
      slotValues[k] = v;
    }
    for (const emit of result.emits) dispatcher.dispatch(emit);
    for (const name of result.stopTimers ?? []) {
      const h = namedTimers.get(name);
      if (h !== undefined) {
        clearInterval(h);
        namedTimers.delete(name);
      }
    }
    render();
  }

  function handleEffectResult(
    effect: string,
    outcome: "ok" | "err",
    value: unknown,
    key: unknown,
  ): void {
    let matched = 0;
    for (const r of app.reducers) {
      if (r.event.kind === "effect" && r.event.effect === effect && r.event.outcome === outcome) {
        applyReducer(r, { $1: value, $2: key });
        matched++;
      }
    }
    // No-silent-failure contract (#37): an `err` result that no `.err` reducer
    // consumes is a dropped error — surfaced (never swallowed) exactly like a
    // live panic. An app that means to ignore an error opts in with an `.err`
    // reducer (even an empty one).
    if (outcome === "err" && matched === 0) reportUnhandledEffectError(effect, value);
  }

  function updateRoute(newPath: string, replace: boolean): void {
    if (replace) router.replace(newPath);
    else router.push(newPath);
    syncRouteFromLocation();
  }

  function syncRouteFromLocation(): void {
    const oldRoute = slotValues.route as ParsedRoute;
    const newRoute = parseLocation(app.routes, router.read());
    slotValues.route = newRoute;
    // Fire route.leave / route.enter reducers
    if (oldRoute && oldRoute.pattern !== newRoute.pattern) {
      for (const r of app.reducers) {
        if (
          r.event.kind === "lifecycle" &&
          r.event.name === `route.leave(${JSON.stringify(oldRoute.pattern)})`
        ) {
          applyReducer(r, { $route: oldRoute });
        }
      }
    }
    for (const r of app.reducers) {
      if (
        r.event.kind === "lifecycle" &&
        r.event.name === `route.enter(${JSON.stringify(newRoute.pattern)})`
      ) {
        applyReducer(r, { $route: newRoute });
      }
    }
    render();
  }

  // Register navigate / toast / log / http builtins on the dispatcher.
  registerBuiltinEffects(
    app,
    updateRoute,
    () => router.back(),
    () => slotValues,
    () => render(),
  );

  // Apply theme defaults to <body> and inject base CSS for tile primitives.
  // Reset the cache so subsequent mounts (e.g. across parallel tests) always
  // re-bind the global `__kumikiApp` reference, even if the theme name matches.
  lastAppliedThemeName = null;
  applyThemeDefaults(app);
  lastAppliedThemeName =
    (app.live?.[app.themeName ?? ""] as string | undefined) ?? app.themeName ?? null;

  // Initial route sync — but first check for a static redirect on the current path.
  if (app.routes && app.routes.length > 0) {
    for (const r of app.routes) {
      if ("redirectTo" in r && matchPattern(r.pattern, router.read().pathname)) {
        router.replace(r.redirectTo);
        break;
      }
    }
    slotValues.route = parseLocation(app.routes, router.read());
    routerUnsub = router.subscribe(syncRouteFromLocation);
  }

  app._rerender = render;
  (
    app as AppShape & { _dispatch?: (name: string, el: Record<string, unknown>) => void }
  )._dispatch = (reducerName: string, el: Record<string, unknown>) => {
    const r = app.reducers.find((x) => x.name === reducerName);
    if (!r) return;
    applyReducer(r, { $el: el, $event: el });
  };
  (app as AppShape & { _setSlot?: (name: string, value: unknown) => void })._setSlot = (
    name: string,
    value: unknown,
  ) => {
    const meta = app.slots[name];
    if (meta?.refine && !meta.refine(value)) return;
    slotValues[name] = value;
    render();
  };
  (app as AppShape & { _navigate?: (path: string, replace?: boolean) => void })._navigate = (
    path: string,
    replace?: boolean,
  ) => {
    updateRoute(path, !!replace);
  };

  // Fire app.start lifecycle + init effects.
  for (const emit of app.init) dispatcher.dispatch(emit);
  for (const r of app.reducers) {
    if (r.event.kind === "lifecycle" && r.event.name === "app.start") {
      applyReducer(r, {});
    }
  }
  // Start timer reducers — each fires its reducer every intervalMs. A named
  // timer is registered so `stop-timer(name)` can clear it; anonymous timers
  // only stop on dispose.
  for (const r of app.reducers) {
    if (r.event.kind === "timer") {
      const handle = setInterval(() => applyReducer(r, {}), r.event.intervalMs);
      if (r.event.name !== undefined) namedTimers.set(r.event.name, handle);
      else anonTimers.push(handle);
    }
  }
  // Fire initial route.enter reducer for current pattern.
  if (app.routes && app.routes.length > 0) {
    const cur = slotValues.route as ParsedRoute;
    for (const r of app.reducers) {
      if (
        r.event.kind === "lifecycle" &&
        r.event.name === `route.enter(${JSON.stringify(cur.pattern)})`
      ) {
        applyReducer(r, { $route: cur });
      }
    }
  }

  render();
  return {
    dispose: () => {
      disposed = true;
      for (const h of anonTimers) clearInterval(h);
      for (const h of namedTimers.values()) clearInterval(h);
      namedTimers.clear();
      routerUnsub?.();
      target.replaceChildren();
      dispatcher.dispose();
    },
  };
}

function makeCapabilityRegistry(
  allowed: string[],
  providers?: Record<string, CapabilityProvider>,
): CapabilityRegistry {
  const ok = new Set(allowed);
  return {
    has: (c) => ok.has(c),
    provider: (c) => providers?.[c],
  };
}

type Dispatcher = {
  dispatch(emit: EmitSpec): void;
  dispose(): void;
};

function makeEffectDispatcher(
  app: AppShape,
  caps: CapabilityRegistry,
  onResult: (effect: string, outcome: "ok" | "err", value: unknown, key: unknown) => void,
): Dispatcher {
  type RunState = {
    inflight: Map<string, AbortController>;
    timers: Map<string, ReturnType<typeof setTimeout>>;
    onceSeen: Map<string, Set<string>>;
  };
  const state: RunState = { inflight: new Map(), timers: new Map(), onceSeen: new Map() };

  const launch = async (eff: EffectSpec, input: unknown, key: string): Promise<void> => {
    if (!caps.has(eff.cap)) {
      console.warn(`Capability "${eff.cap}" not declared in app.caps`);
      return;
    }
    try {
      const res = await eff.invoke(input, caps);
      onResult(eff.name, res.kind, res.value, input);
    } catch (e) {
      onResult(eff.name, "err", { message: String(e) }, input);
    } finally {
      const ic = state.inflight.get(`${eff.name}:${key}`);
      if (ic) state.inflight.delete(`${eff.name}:${key}`);
    }
  };

  return {
    dispatch(emit: EmitSpec): void {
      const eff = app.effects[emit.effect];
      if (!eff) return;
      const input = emit.args[0];
      const policy = eff.policy ?? { kind: "default" as const };
      const keyOf = (input: unknown): string => {
        if (policy.kind === "latest-per-key") return policy.keyOf(input);
        return "_";
      };
      const key = keyOf(input);
      const id = `${eff.name}:${key}`;
      if (policy.kind === "once") {
        const seen = state.onceSeen.get(eff.name) ?? new Set<string>();
        const k = JSON.stringify(input ?? null);
        if (seen.has(k)) return;
        seen.add(k);
        state.onceSeen.set(eff.name, seen);
        void launch(eff, input, key);
        return;
      }
      if (policy.kind === "debounce") {
        const t = state.timers.get(id);
        if (t) clearTimeout(t);
        state.timers.set(
          id,
          setTimeout(() => {
            state.timers.delete(id);
            void launch(eff, input, key);
          }, policy.ms),
        );
        return;
      }
      if (policy.kind === "throttle") {
        if (state.timers.has(id)) return;
        state.timers.set(
          id,
          setTimeout(() => state.timers.delete(id), policy.ms),
        );
        void launch(eff, input, key);
        return;
      }
      if (policy.kind === "latest" || policy.kind === "latest-per-key") {
        const ic = state.inflight.get(id);
        if (ic) ic.abort();
        const ctl = new AbortController();
        state.inflight.set(id, ctl);
        void launch(eff, input, key);
        return;
      }
      void launch(eff, input, key);
    },
    dispose(): void {
      for (const t of state.timers.values()) clearTimeout(t);
      state.timers.clear();
      for (const c of state.inflight.values()) c.abort();
      state.inflight.clear();
    },
  };
}

function registerBuiltinEffects(
  app: AppShape,
  navigate: (path: string, replace: boolean) => void,
  back: () => void,
  getLive: () => Record<string, unknown>,
  rerender: () => void,
): void {
  // Each built-in first defers to a host provider registered for its capability
  // (the ecosystem seam — lets a host override navigation/toast/log), then runs
  // the default behavior.
  const overridable = (
    cap: string,
    fn: (input: unknown) => Promise<EffectResult>,
  ): EffectSpec["invoke"] => {
    return async (input, caps) => {
      const p = caps.provider(cap);
      if (p) return p(input, caps);
      return fn(input);
    };
  };
  app.effects.navigate = {
    name: "navigate",
    cap: "nav.push",
    invoke: overridable("nav.push", async (input) => {
      const x = input as {
        path: string;
        params?: Record<string, string>;
        query?: Record<string, string>;
      };
      navigate(buildPath(x), false);
      return { kind: "ok", value: null };
    }),
  };
  app.effects["navigate-replace"] = {
    name: "navigate-replace",
    cap: "nav.replace",
    invoke: overridable("nav.replace", async (input) => {
      const x = input as {
        path: string;
        params?: Record<string, string>;
        query?: Record<string, string>;
      };
      navigate(buildPath(x), true);
      return { kind: "ok", value: null };
    }),
  };
  app.effects["navigate-back"] = {
    name: "navigate-back",
    cap: "nav.back",
    invoke: overridable("nav.back", async () => {
      back();
      return { kind: "ok", value: null };
    }),
  };
  app.effects.toast = {
    name: "toast",
    cap: "notification.show",
    invoke: overridable("notification.show", async (input) => {
      const t = input as { kind?: string; text?: string };
      const banner = document.createElement("div");
      banner.style.cssText =
        "position:fixed;bottom:24px;right:24px;padding:8px 16px;background:#1a1a1a;color:#fff;border-radius:8px;z-index:9999;";
      banner.textContent = t.text ?? "";
      document.body.appendChild(banner);
      setTimeout(() => banner.remove(), 3000);
      return { kind: "ok", value: null };
    }),
  };
  app.effects.log = {
    name: "log",
    cap: "log.write",
    invoke: overridable("log.write", async (input) => {
      console.log("[kumiki]", input);
      return { kind: "ok", value: null };
    }),
  };
  // http capability is handled per-effect by the codegen (each declared `effect`
  // gets its own invoke function); this builtin only handles the navigation/toast
  // shortcuts above.
  void getLive;
  void rerender;
}

function buildPath(x: {
  path: string;
  params?: Record<string, string>;
  query?: Record<string, string>;
}): string {
  let p = x.path;
  if (x.params) {
    for (const [k, v] of Object.entries(x.params)) {
      p = p.replace(`{${k}}`, encodeURIComponent(v));
      p = p.replace(`:${k}`, encodeURIComponent(v));
    }
  }
  if (x.query) {
    const q = new URLSearchParams(x.query).toString();
    if (q) p += `?${q}`;
  }
  return p;
}

// ----- DOM rendering -----

/** Record the child-index chain from `root` down to `el`, for focus restore. */
function domPath(el: Element, root: Element): number[] {
  const path: number[] = [];
  let cur: Element | null = el;
  while (cur && cur !== root) {
    const parent: Element | null = cur.parentElement;
    if (!parent) break;
    path.unshift(Array.prototype.indexOf.call(parent.children, cur));
    cur = parent;
  }
  return path;
}

/** Re-walk a child-index chain produced by domPath to find the element. */
function elementAtPath(path: number[], root: Element): Element | null {
  let cur: Element | null = root;
  for (const idx of path) {
    if (!cur) return null;
    cur = cur.children[idx] ?? null;
  }
  return cur;
}

function _setPathHelper(obj: unknown, path: string[], value: unknown): unknown {
  if (path.length === 0) return value;
  const [head, ...rest] = path;
  const cur = (obj && typeof obj === "object" ? obj : {}) as Record<string, unknown>;
  return { ...cur, [head!]: _setPathHelper(cur[head!], rest, value) };
}

/** Message + optional source location for a caught throw (panic or otherwise). */
function panicInfo(e: unknown): { message: string; location: string | undefined } {
  if (isPanic(e)) return { message: e.message, location: e.location };
  if (e instanceof Error) return { message: e.message, location: undefined };
  return { message: String(e), location: undefined };
}

/**
 * Surface a caught live panic so the verification tiers still see it: smoke()
 * and runScenario() both patch console.error into their issue/error buffers, so
 * a controlled panic is reported as a failure rather than silently swallowed.
 */
function reportPanic(where: string, e: unknown): void {
  const { message } = panicInfo(e);
  console.error(`[kumiki] ${isPanic(e) ? "panic" : "error"} in ${where}: ${message}`);
}

/**
 * Surface an effect `err` result that no `.err` reducer consumes (#37). A failed
 * capability must never fail silently — the storage-unavailable case (sandbox /
 * private mode) otherwise looks like the app does nothing. Reported via
 * console.error so the verification tiers (smoke / runScenario, which patch
 * console.error) flag it, consistent with the v0.3 panic model. Production noise
 * is the app's own choice: wire an `.err` reducer to handle (or deliberately
 * ignore) the error.
 */
function reportUnhandledEffectError(effect: string, value: unknown): void {
  const message =
    value && typeof value === "object" && "message" in value
      ? String((value as { message: unknown }).message)
      : String(value);
  console.error(`[kumiki] effect "${effect}" returned an error with no .err reducer: ${message}`);
}

/** A minimal top-level fallback for a render panic with no enclosing boundary. */
function renderPanicFallback(e: unknown): HTMLElement {
  const { message, location } = panicInfo(e);
  const div = document.createElement("div");
  div.dataset.kumikiPanic = location ?? "";
  div.setAttribute("role", "alert");
  div.textContent = `Something went wrong: ${message}`;
  return div;
}

function renderTile(node: TileNode): HTMLElement {
  const el = renderTileNode(node);
  // A `motion` prop applies to any tile uniformly (M5). The keyframes/classes
  // are injected once at mount by ensureMotionStyles.
  applyMotion(el, node.props);
  return el;
}

function renderTileNode(node: TileNode): HTMLElement {
  switch (node.kind) {
    case "page":
    case "column": {
      const div = document.createElement("div");
      div.dataset.kumikiTile = node.kind;
      div.style.display = "flex";
      div.style.flexDirection = "column";
      applyContainerProps(div, node.props);
      for (const child of node.children) {
        if (child != null) div.appendChild(renderTile(child));
      }
      return div;
    }
    case "row": {
      const div = document.createElement("div");
      div.dataset.kumikiTile = "row";
      div.style.display = "flex";
      div.style.flexDirection = "row";
      applyContainerProps(div, node.props);
      for (const child of node.children) {
        if (child != null) div.appendChild(renderTile(child));
      }
      return div;
    }
    case "card":
    case "box":
    case "panel":
    case "fieldset":
    case "stack":
    case "region":
    case "scroll": {
      const div = document.createElement("div");
      div.dataset.kumikiTile = node.kind;
      if (node.kind === "card") {
        // Default padding only if the prop didn't override it.
        if (!node.props || node.props.pad === undefined) div.style.padding = "16px";
        div.style.marginBottom = "12px";
        div.style.borderRadius = "8px";
      }
      if (node.kind === "scroll") {
        div.style.overflow = "auto";
      }
      if (node.kind === "stack") {
        div.style.display = "flex";
        div.style.flexDirection = "column";
      }
      applyContainerProps(div, node.props);
      for (const child of node.children) {
        if (child != null) div.appendChild(renderTile(child));
      }
      return div;
    }
    case "overlay": {
      // z-axis stacking: child[0] is the base layer (normal flow); later
      // children are each wrapped in an absolutely-positioned layer covering
      // the container, placed by the `align` prop. The base layer's layout is
      // unaffected by the overlays (they are out of flow).
      const div = document.createElement("div");
      div.dataset.kumikiTile = "overlay";
      div.style.position = "relative";
      applyContainerProps(div, node.props);
      const align = typeof node.props?.align === "string" ? (node.props.align as string) : "center";
      const kids = node.children.filter((c): c is TileNode => c != null);
      kids.forEach((child, i) => {
        if (i === 0) {
          div.appendChild(renderTile(child));
          return;
        }
        const layer = document.createElement("div");
        layer.dataset.kumikiTile = "overlay-layer";
        layer.style.position = "absolute";
        layer.style.inset = "0";
        layer.style.display = "flex";
        applyOverlayAlign(layer, align);
        layer.appendChild(renderTile(child));
        div.appendChild(layer);
      });
      return div;
    }
    case "grid": {
      const div = document.createElement("div");
      div.dataset.kumikiTile = "grid";
      div.style.display = "grid";
      const cols = node.props?.cols;
      if (typeof cols === "number") div.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
      else if (typeof cols === "string") div.style.gridTemplateColumns = cols;
      else div.style.gridTemplateColumns = "repeat(3, 1fr)";
      applyContainerProps(div, node.props);
      for (const child of node.children) {
        if (child != null) div.appendChild(renderTile(child));
      }
      return div;
    }
    case "divider": {
      const hr = document.createElement("hr");
      hr.dataset.kumikiTile = "divider";
      return hr;
    }
    case "heading": {
      const h = document.createElement("h1");
      h.dataset.kumikiTile = "heading";
      h.textContent = node.text;
      applyTextProps(h, node.props);
      return h;
    }
    case "text": {
      const span = document.createElement("span");
      span.dataset.kumikiTile = "text";
      span.textContent = node.text;
      applyTextProps(span, node.props);
      return span;
    }
    case "button": {
      const b = document.createElement("button");
      b.dataset.kumikiTile = "button";
      b.textContent = node.text;
      if (node.disabled) b.disabled = true;
      if (node.props?.onClick) {
        b.addEventListener("click", (e) => {
          e.preventDefault();
          node.props?.onClick?.(node.props?.el ?? {});
        });
      }
      return b;
    }
    case "input": {
      const inp = document.createElement("input");
      inp.dataset.kumikiTile = "input";
      inp.type = node.type ?? "text";
      if (node.placeholder) inp.placeholder = node.placeholder;
      if (node.required) inp.required = true;
      if (node.autoFocus) inp.autofocus = true;
      if (node.id) inp.id = node.id;
      if (node.bind) {
        const fullPath =
          node.bindPath && node.bindPath.length > 0
            ? `${node.bind}.${node.bindPath.join(".")}`
            : node.bind;
        inp.dataset.kumikiBind = fullPath;
      }
      inp.value = node.value ?? "";
      if (node.bind) {
        const slotName = node.bind;
        const bindPath = node.bindPath;
        inp.addEventListener("input", () => {
          const win = window as unknown as { __kumikiApp?: AppShape };
          const app = win.__kumikiApp as AppShape & {
            _setSlot?: (n: string, v: unknown) => void;
            live?: Record<string, unknown>;
          };
          if (!app?._setSlot) return;
          if (bindPath && bindPath.length > 0) {
            const current = app.live?.[slotName] ?? {};
            const next = _setPathHelper(current, bindPath, inp.value);
            app._setSlot(slotName, next);
          } else {
            app._setSlot(slotName, inp.value);
          }
        });
      }
      if (node.props?.onInput) {
        inp.addEventListener("input", () => {
          node.props?.onInput?.({ ...(node.props?.el ?? {}), value: inp.value });
        });
      }
      if (node.props?.onChange) {
        inp.addEventListener("change", () => {
          node.props?.onChange?.({ ...(node.props?.el ?? {}), value: inp.value });
        });
      }
      return inp;
    }
    case "textarea": {
      const ta = document.createElement("textarea");
      ta.dataset.kumikiTile = "textarea";
      if (node.rows) ta.rows = node.rows;
      if (node.placeholder) ta.placeholder = node.placeholder;
      if (node.id) ta.id = node.id;
      if (node.bind) {
        const fullPath =
          node.bindPath && node.bindPath.length > 0
            ? `${node.bind}.${node.bindPath.join(".")}`
            : node.bind;
        ta.dataset.kumikiBind = fullPath;
      }
      ta.value = node.value ?? "";
      if (node.bind) {
        const slotName = node.bind;
        const bindPath = node.bindPath;
        ta.addEventListener("input", () => {
          const win = window as unknown as { __kumikiApp?: AppShape };
          const app = win.__kumikiApp as AppShape & {
            _setSlot?: (n: string, v: unknown) => void;
            live?: Record<string, unknown>;
          };
          if (!app?._setSlot) return;
          if (bindPath && bindPath.length > 0) {
            const current = app.live?.[slotName] ?? {};
            const next = _setPathHelper(current, bindPath, ta.value);
            app._setSlot(slotName, next);
          } else {
            app._setSlot(slotName, ta.value);
          }
        });
      }
      return ta;
    }
    case "check": {
      const wrap = document.createElement("label");
      wrap.dataset.kumikiTile = "check";
      const inp = document.createElement("input");
      inp.type = "checkbox";
      inp.checked = node.checked;
      if (node.props?.onClick) {
        inp.addEventListener("change", () => {
          node.props?.onClick?.(node.props?.el ?? {});
        });
      }
      wrap.appendChild(inp);
      return wrap;
    }
    case "spinner": {
      const span = document.createElement("span");
      span.dataset.kumikiTile = "spinner";
      span.textContent = "…";
      return span;
    }
    case "select": {
      const sel = document.createElement("select");
      sel.dataset.kumikiTile = "select";
      const options = (node.options ?? []) as Array<{ label: unknown; value: unknown }>;
      const currentValue = node.value;
      // Serialize a value to a stable key. Must recurse into variant payloads
      // so `Some(Backlog)` and `Some(InProgress)` map to distinct keys (a flat
      // `_tag`-only key would collide on the outer "Some").
      const valueKey = (v: unknown): string => {
        if (v && typeof v === "object" && "_tag" in (v as Record<string, unknown>)) {
          const t = v as Record<string, unknown>;
          const parts: string[] = [String(t._tag)];
          for (let i = 0; `_${i}` in t; i++) parts.push(valueKey(t[`_${i}`]));
          return parts.join("|");
        }
        return JSON.stringify(v);
      };
      const currentKey = valueKey(currentValue);
      if (node.placeholder) {
        const ph = document.createElement("option");
        ph.value = "";
        ph.textContent = String(node.placeholder);
        ph.disabled = true;
        if (currentValue == null) ph.selected = true;
        sel.appendChild(ph);
      }
      for (const opt of options) {
        const o = document.createElement("option");
        const k = valueKey(opt.value);
        o.value = k;
        o.textContent = String(opt.label);
        if (k === currentKey) o.selected = true;
        sel.appendChild(o);
      }
      sel.addEventListener("change", () => {
        const k = sel.value;
        const matched = options.find((o) => valueKey(o.value) === k);
        if (matched === undefined) return;
        const win = window as unknown as { __kumikiApp?: AppShape };
        const app = win.__kumikiApp as AppShape & {
          _setSlot?: (n: string, v: unknown) => void;
          live?: Record<string, unknown>;
        };
        if (node.bind && app?._setSlot) {
          const slotName = node.bind;
          const bindPath = node.bindPath;
          if (bindPath && bindPath.length > 0) {
            const current = app.live?.[slotName] ?? {};
            const next = _setPathHelper(current, bindPath, matched.value);
            app._setSlot(slotName, next);
          } else {
            app._setSlot(slotName, matched.value);
          }
        }
        // Fire onChange handler (set up by `ui.change(SelectTile)` reducers) so
        // both bound and unbound select tiles can drive logic that reads $event.value.
        if (node.props?.onChange) {
          node.props.onChange({ ...(node.props.el ?? {}), value: matched.value });
        }
      });
      return sel;
    }
    case "radio": {
      const wrap = document.createElement("label");
      wrap.dataset.kumikiTile = "radio";
      const inp = document.createElement("input");
      inp.type = "radio";
      if (node.group) inp.name = String(node.group);
      inp.checked = !!node.selected;
      const labelText = (node.props?.label as string | undefined) ?? "";
      wrap.appendChild(inp);
      if (labelText) {
        const span = document.createElement("span");
        span.textContent = labelText;
        wrap.appendChild(span);
      }
      if (node.props?.onClick) {
        inp.addEventListener("change", () => {
          node.props?.onClick?.(node.props?.el ?? {});
        });
      }
      return wrap;
    }
    case "skeleton": {
      const div = document.createElement("div");
      div.dataset.kumikiTile = "skeleton";
      div.style.background = "#eee";
      div.style.borderRadius = "8px";
      div.style.minHeight = "60px";
      const h = node.props?.h;
      if (typeof h === "number") div.style.height = `${h}px`;
      return div;
    }
    case "form": {
      const form = document.createElement("form");
      form.dataset.kumikiTile = "form";
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        if (node.props?.onSubmit) node.props.onSubmit(node.props.el ?? {});
      });
      for (const child of node.children) {
        if (child != null) form.appendChild(renderTile(child));
      }
      return form;
    }
    case "label": {
      const lbl = document.createElement("label");
      lbl.dataset.kumikiTile = "label";
      lbl.textContent = node.text;
      const forAttr = node.props?.for;
      if (typeof forAttr === "string") lbl.htmlFor = forAttr;
      return lbl;
    }
    case "link": {
      const a = document.createElement("a");
      a.dataset.kumikiTile = "link";
      a.href = node.to;
      a.textContent = node.text;
      a.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        const win = window as unknown as { __kumikiApp?: AppShape };
        const nav = (win.__kumikiApp as AppShape & { _navigate?: (p: string, r?: boolean) => void })
          ?._navigate;
        if (nav) nav(node.to, false);
      });
      return a;
    }
    case "markdown": {
      const div = document.createElement("div");
      div.dataset.kumikiTile = "markdown";
      // Minimal markdown: paragraphs split on blank lines, single line breaks preserved.
      const text = node.text ?? "";
      const paragraphs = text.split(/\n\s*\n/);
      for (const para of paragraphs) {
        const p = document.createElement("p");
        p.textContent = para.trim();
        p.style.whiteSpace = "pre-wrap";
        div.appendChild(p);
      }
      return div;
    }
    case "image": {
      const img = document.createElement("img");
      img.dataset.kumikiTile = "image";
      img.src = node.src;
      const alt = node.props?.alt;
      if (typeof alt === "string") img.alt = alt;
      return img;
    }
    case "icon": {
      const span = document.createElement("span");
      span.dataset.kumikiTile = "icon";
      span.textContent = `[${node.name}]`;
      return span;
    }
  }
}

function applyContainerProps(el: HTMLElement, props?: TileProps): void {
  if (!props) return;
  applyResponsive(el, props.gap, (v) => (el.style.gap = mapToken(String(v))));
  applyResponsive(el, props.align, (v) => (el.style.alignItems = mapAlign(String(v))));
  applyResponsive(el, props.justify, (v) => (el.style.justifyContent = mapJustify(String(v))));
  applyResponsive(el, props.pad, (v) => (el.style.padding = mapToken(String(v))));
  const mw = props["max-w"] ?? props.maxWidth;
  if (mw !== undefined) el.style.maxWidth = typeof mw === "number" ? `${mw}px` : String(mw);
  if (typeof props.bg === "string") el.style.background = mapColor(props.bg as string);
  if (typeof props.radius === "string") el.style.borderRadius = mapToken(props.radius as string);
  applyStateStyles(el, props);
  applyTransition(el, props);
}

/**
 * Place an overlay layer inside its `position: relative` container via flexbox.
 * The token combines a vertical part (`top` / `bottom`, default center) and a
 * horizontal part (`left` / `right`, default center), e.g. `top-left`,
 * `bottom`, `center`. Unknown parts fall back to center (consistent with how
 * other style-prop tokens pass through without compile-time validation).
 */
function applyOverlayAlign(layer: HTMLElement, align: string): void {
  const parts = align.split("-");
  const has = (k: string): boolean => parts.includes(k);
  layer.style.alignItems = has("top") ? "flex-start" : has("bottom") ? "flex-end" : "center";
  layer.style.justifyContent = has("left") ? "flex-start" : has("right") ? "flex-end" : "center";
}

/** Apply a value that may be a literal or a responsive `{base, sm, md, lg, xl}` map. */
function applyResponsive(_el: HTMLElement, raw: unknown, set: (v: unknown) => void): void {
  if (raw === undefined || raw === null) return;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    set(raw);
    return;
  }
  const m = raw as Record<string, unknown>;
  if (m.base !== undefined) set(m.base);
  // Pick the first matching breakpoint from largest to smallest.
  const order: Array<["xl" | "lg" | "md" | "sm", string]> = [
    ["xl", "(min-width: 1280px)"],
    ["lg", "(min-width: 1024px)"],
    ["md", "(min-width: 768px)"],
    ["sm", "(min-width: 640px)"],
  ];
  for (const [bp, q] of order) {
    if (m[bp] !== undefined && window.matchMedia(q).matches) {
      set(m[bp]);
      return;
    }
  }
}

function ensureAnimationStyles(): void {
  // Keyed by presence in the active style root, so each root (document head or a
  // shadow root) gets its own copy of the v0.1 animation keyframes.
  if (findStyleNode("kumiki-animations")) return;
  const css = `
@keyframes kumiki-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes kumiki-slide-up { from { transform: translateY(8px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
@keyframes kumiki-slide-down { from { transform: translateY(-8px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
.kumiki-anim { animation-fill-mode: both; animation-timing-function: ease; animation-duration: 300ms; }
.kumiki-anim-fade { animation-name: kumiki-fade; }
.kumiki-anim-slide-up { animation-name: kumiki-slide-up; }
.kumiki-anim-slide-down { animation-name: kumiki-slide-down; }
.kumiki-anim-fast { animation-duration: 150ms; }
.kumiki-anim-normal { animation-duration: 300ms; }
.kumiki-anim-slow { animation-duration: 600ms; }
`;
  const style = document.createElement("style");
  style.id = "kumiki-animations";
  style.appendChild(document.createTextNode(css));
  appendStyleNode(style);
}

function applyTransition(el: HTMLElement, props?: TileProps): void {
  if (!props) return;
  const t = props.transition;
  if (typeof t !== "string") return;
  ensureAnimationStyles();
  el.classList.add("kumiki-anim", `kumiki-anim-${t}`);
  const d = props["transition-duration"];
  if (typeof d === "string") el.classList.add(`kumiki-anim-${d}`);
}

// ----- motion layer (v0.2 M5) -----
// Reusable, scoped animations declared with `motion N = {...}` and referenced
// from a tile's `motion` prop. Codegen puts the parsed definitions on
// `App.motions`; the runtime turns each into a scoped `@keyframes` + class at
// mount, honoring `prefers-reduced-motion`.

/** Map a duration token (or a raw ms number) to a CSS duration. */
function motionDuration(d: unknown): string {
  if (typeof d === "number") return `${d}ms`;
  if (d === "fast") return "150ms";
  if (d === "slow") return "600ms";
  return "300ms"; // "normal" / default
}

/** Build the CSS declarations for one keyframe stop from the closed prop set. */
function motionStopCss(stop: unknown): string {
  const s = (stop ?? {}) as Record<string, unknown>;
  const decls: string[] = [];
  const transform: string[] = [];
  if (typeof s.opacity === "number") decls.push(`opacity: ${s.opacity}`);
  if (typeof s["translate-x"] === "number") transform.push(`translateX(${s["translate-x"]}px)`);
  if (typeof s["translate-y"] === "number") transform.push(`translateY(${s["translate-y"]}px)`);
  if (typeof s.scale === "number") transform.push(`scale(${s.scale})`);
  if (typeof s.rotate === "number") transform.push(`rotate(${s.rotate}deg)`);
  if (transform.length > 0) decls.push(`transform: ${transform.join(" ")}`);
  return decls.join("; ");
}

/** Build the `@keyframes` + class CSS for one motion definition. */
function motionCss(name: string, spec: unknown): string {
  const s = (spec ?? {}) as Record<string, unknown>;
  const kf = (s.keyframes ?? {}) as Record<string, unknown>;
  const from = motionStopCss(kf.from);
  const to = motionStopCss(kf.to);
  const easing = typeof s.easing === "string" ? s.easing : "ease";
  const iteration =
    s.iteration === "infinite"
      ? "infinite"
      : typeof s.iteration === "number"
        ? String(s.iteration)
        : "1";
  const direction = typeof s.direction === "string" ? s.direction : "normal";
  const cls = `kumiki-motion-${name}`;
  return [
    `@keyframes ${cls} { from { ${from} } to { ${to} } }`,
    `.${cls} { animation-name: ${cls}; animation-duration: ${motionDuration(s.duration)}; animation-timing-function: ${easing}; animation-iteration-count: ${iteration}; animation-direction: ${direction}; animation-fill-mode: both; }`,
  ].join("\n");
}

/** Inject the app's motion keyframes + a `prefers-reduced-motion` guard at mount. */
// Where Kumiki's <style> nodes go and which element carries body-level theme
// styles. Set per mount (see MountOptions.styleRoot / styleHost). Module-level
// because a compiled app is single-instance (its render closures bind to one
// module's live state), like the other style singletons below. Left null until
// mount so merely importing this module never touches `document` (keeps non-DOM
// imports — e.g. a Vite-compiled bundle loaded in Node — safe).
let currentStyleRoot: Document | ShadowRoot | null = null;
let currentStyleHost: HTMLElement | null = null;

/** Find a Kumiki style node by id within the active style root. */
function findStyleNode(id: string): HTMLStyleElement | null {
  const root = currentStyleRoot ?? document;
  return root.getElementById(id) as HTMLStyleElement | null;
}

/** Append a style node to the active style root (document head, or a shadow root). */
function appendStyleNode(style: HTMLStyleElement): void {
  const root = currentStyleRoot ?? document;
  // A Document has `.head`; a ShadowRoot does not. Duck-typing avoids referencing
  // the global `Document` constructor, which isn't defined in every DOM shim.
  const head = (root as Document).head;
  if (head) head.appendChild(style);
  else (root as ShadowRoot).appendChild(style);
}

/** The element that carries body-level theme styles (background/fg/font). */
function styleHostEl(): HTMLElement {
  return currentStyleHost ?? document.body;
}

function ensureMotionStyles(app: AppShape): void {
  const motions = app.motions ?? {};
  const rules = Object.entries(motions).map(([name, spec]) => motionCss(name, spec));
  // a11y (M5 AC5): disable motion AND the v0.1 transitions when the user asks.
  rules.push(
    `@media (prefers-reduced-motion: reduce) { .kumiki-motion, .kumiki-anim { animation: none !important } }`,
  );
  let style = findStyleNode("kumiki-motions");
  if (!style) {
    style = document.createElement("style");
    style.id = "kumiki-motions";
    appendStyleNode(style);
  }
  style.textContent = rules.join("\n");
}

/** Add the generated motion class to a tile that carries a `motion: "Name"` prop. */
function applyMotion(el: HTMLElement, props?: TileProps): void {
  if (!props) return;
  const m = props.motion;
  if (typeof m !== "string") return;
  el.classList.add("kumiki-motion", `kumiki-motion-${m}`);
}

let stateStyleSeq = 0;
let stateStylesEl: HTMLStyleElement | null = null;

function applyStateStyles(el: HTMLElement, props: TileProps): void {
  for (const state of ["hover", "focus", "active", "disabled", "selected"] as const) {
    const sub = props[state];
    if (!sub || typeof sub !== "object" || Array.isArray(sub)) continue;
    const id = `s${++stateStyleSeq}`;
    el.dataset.kumikiState = el.dataset.kumikiState ? `${el.dataset.kumikiState} ${id}` : id;
    const decls = stateStyleDecls(sub as Record<string, unknown>);
    if (!stateStylesEl) {
      stateStylesEl = findStyleNode("kumiki-state-styles");
      if (!stateStylesEl) {
        stateStylesEl = document.createElement("style");
        stateStylesEl.id = "kumiki-state-styles";
        appendStyleNode(stateStylesEl);
      }
    }
    const selector =
      state === "hover"
        ? ":hover"
        : state === "focus"
          ? ":focus"
          : state === "active"
            ? ":active"
            : state === "disabled"
              ? ":disabled"
              : "[data-kumiki-selected]";
    stateStylesEl.appendChild(
      document.createTextNode(`[data-kumiki-state~="${id}"]${selector} { ${decls} }\n`),
    );
  }
}

function stateStyleDecls(sub: Record<string, unknown>): string {
  const decls: string[] = [];
  if (typeof sub.bg === "string") decls.push(`background: ${mapColor(sub.bg as string)}`);
  if (typeof sub.color === "string") decls.push(`color: ${mapColor(sub.color as string)}`);
  if (typeof sub.shadow === "string") decls.push(`box-shadow: ${sub.shadow}`);
  return decls.join("; ");
}

function applyTextProps(el: HTMLElement, props?: TileProps): void {
  if (!props) return;
  if (props.strike) el.style.textDecoration = "line-through";
  if (typeof props.color === "string") el.style.color = mapColor(props.color as string);
  if (typeof props.size === "string") el.style.fontSize = mapSize(props.size as string);
  if (props.weight === "bold") el.style.fontWeight = "700";
  applyStateStyles(el, props);
}

let lastAppliedThemeName: string | null = null;
function maybeReapplyTheme(app: AppShape): void {
  // Resolve the current theme name (could be slot-driven via `app.theme = slotName`).
  let name = app.themeName;
  if (
    name &&
    app.themes &&
    !(name in app.themes) &&
    app.live &&
    typeof app.live[name] === "string"
  ) {
    name = app.live[name] as string;
  }
  if (name === lastAppliedThemeName) return;
  lastAppliedThemeName = name ?? null;
  applyThemeDefaults(app);
}

function applyThemeDefaults(app: AppShape): void {
  // We need __kumikiApp set before currentTheme() works.
  (window as unknown as { __kumikiApp?: AppShape }).__kumikiApp = app;
  const theme = currentTheme();
  if (!theme) return;
  const colors = (theme.colors ?? {}) as Record<string, ThemeValue>;
  const typography = (theme.typography ?? {}) as Record<string, ThemeValue>;
  const sizes = (typography.size ?? {}) as Record<string, ThemeValue>;
  const host = styleHostEl();
  if (typeof colors.bg === "string") host.style.background = colors.bg;
  if (typeof colors.fg === "string") host.style.color = colors.fg;
  if (typeof typography.family === "string") host.style.fontFamily = typography.family as string;
  if (typeof sizes.md === "string") host.style.fontSize = sizes.md as string;
  if (typeof typography["line-height"] === "string")
    host.style.lineHeight = String(typography["line-height"]);
  // Inject CSS for primitives that need theme tokens.
  // Remove any prior injection first so re-renders (e.g. theme switching) don't
  // accumulate <style> nodes in the active style root.
  const prior = findStyleNode("kumiki-theme-base");
  if (prior) prior.remove();
  const css = document.createElement("style");
  css.id = "kumiki-theme-base";
  css.appendChild(
    document.createTextNode(`
[data-kumiki-tile="card"] {
  background: ${typeof colors.surface === "string" ? colors.surface : "#fff"};
  border: 1px solid ${typeof colors.border === "string" ? colors.border : "#e0e0e0"};
  box-shadow: ${themeShadow(theme, "sm") ?? "0 1px 2px rgba(0,0,0,0.08)"};
}
[data-kumiki-tile="button"] {
  background: ${typeof colors.surface === "string" ? colors.surface : "#fff"};
  color: ${typeof colors.fg === "string" ? colors.fg : "#1a1a1a"};
  border: 1px solid ${typeof colors.border === "string" ? colors.border : "#ddd"};
  padding: 6px 12px;
  cursor: pointer;
  border-radius: ${themeRadius(theme, "md") ?? "8px"};
}
[data-kumiki-tile="button"]:hover { filter: brightness(0.97); }
[data-kumiki-tile="input"], [data-kumiki-tile="textarea"] {
  font: inherit;
  padding: 6px 10px;
  border: 1px solid ${typeof colors.border === "string" ? colors.border : "#ddd"};
  border-radius: ${themeRadius(theme, "sm") ?? "4px"};
  background: ${typeof colors.surface === "string" ? colors.surface : "#fff"};
  color: ${typeof colors.fg === "string" ? colors.fg : "#1a1a1a"};
}
[data-kumiki-tile="input"]:focus, [data-kumiki-tile="textarea"]:focus {
  outline: 2px solid ${typeof colors.primary === "string" ? colors.primary : "#0070f3"};
  outline-offset: 1px;
}
[data-kumiki-tile="link"] {
  color: ${typeof colors.primary === "string" ? colors.primary : "#0070f3"};
  text-decoration: none;
}
[data-kumiki-tile="link"]:hover { text-decoration: underline; }
[data-kumiki-tile="heading"] {
  font-size: ${typeof sizes.xl === "string" ? sizes.xl : "28px"};
  font-weight: 700;
  margin: 0 0 8px;
}
[data-kumiki-tile="markdown"] p { margin: 0 0 12px; }
`),
  );
  appendStyleNode(css);
}

function themeShadow(theme: Theme, key: string): string | undefined {
  const shadow = theme.shadow;
  if (shadow && typeof shadow === "object" && !Array.isArray(shadow)) {
    const v = (shadow as Record<string, ThemeValue>)[key];
    if (typeof v === "string") return v;
  }
  return undefined;
}

function themeRadius(theme: Theme, key: string): string | undefined {
  const radius = theme.radius;
  if (radius && typeof radius === "object" && !Array.isArray(radius)) {
    const v = (radius as Record<string, ThemeValue>)[key];
    if (typeof v === "string") return v;
  }
  return undefined;
}

function resolveToken(group: string, name: string): string {
  const theme = currentTheme();
  if (theme) {
    const sec = theme[group];
    if (sec && typeof sec === "object" && !Array.isArray(sec) && name in sec) {
      const v = (sec as Record<string, ThemeValue>)[name];
      if (typeof v === "string") return v;
      if (typeof v === "number") return `${v}px`;
    }
  }
  return name;
}

function currentTheme(): Theme | null {
  const win = window as unknown as { __kumikiApp?: AppShape };
  const app = win.__kumikiApp;
  if (!app?.themes) return null;
  let name = app.themeName;
  // If `app.theme = someSlot` was used in source, app.themeName holds the slot
  // NAME (e.g. "themeName"). Resolve through the live slot value so theme
  // switching at runtime takes effect.
  if (name && !(name in app.themes) && app.live && typeof app.live[name] === "string") {
    name = app.live[name] as string;
  }
  if (!name) name = Object.keys(app.themes)[0];
  if (!name) return null;
  return app.themes[name] ?? null;
}

function mapToken(t: string): string {
  // Use theme.spacing for known token names; fall back to literal.
  const theme = currentTheme();
  if (theme?.spacing && typeof theme.spacing === "object") {
    const sec = theme.spacing as Record<string, ThemeValue>;
    if (t in sec) {
      const v = sec[t];
      if (typeof v === "string") return v;
      if (typeof v === "number") return `${v}px`;
    }
  }
  switch (t) {
    case "xs":
      return "4px";
    case "sm":
      return "8px";
    case "md":
      return "16px";
    case "lg":
      return "24px";
    case "xl":
      return "40px";
    case "xxl":
      return "64px";
    default:
      return t;
  }
}
function mapAlign(a: string): string {
  switch (a) {
    case "start":
      return "flex-start";
    case "end":
      return "flex-end";
    case "center":
      return "center";
    case "stretch":
      return "stretch";
    default:
      return a;
  }
}
function mapJustify(a: string): string {
  switch (a) {
    case "start":
      return "flex-start";
    case "end":
      return "flex-end";
    case "center":
      return "center";
    case "between":
      return "space-between";
    case "around":
      return "space-around";
    default:
      return a;
  }
}
function mapColor(c: string): string {
  const theme = currentTheme();
  if (theme?.colors && typeof theme.colors === "object") {
    const sec = theme.colors as Record<string, ThemeValue>;
    if (c in sec) {
      const v = sec[c];
      if (typeof v === "string") return v;
    }
  }
  switch (c) {
    case "muted":
      return "#888";
    case "danger":
      return "#c4222a";
    case "primary":
      return "#0070f3";
    case "fg":
      return "#1a1a1a";
    case "surface":
      return "#f7f7f7";
    default:
      return c;
  }
}
function mapSize(s: string): string {
  const theme = currentTheme();
  if (theme?.typography && typeof theme.typography === "object") {
    const tg = theme.typography as Record<string, ThemeValue>;
    const sz = tg.size;
    if (
      sz &&
      typeof sz === "object" &&
      !Array.isArray(sz) &&
      s in (sz as Record<string, ThemeValue>)
    ) {
      const v = (sz as Record<string, ThemeValue>)[s];
      if (typeof v === "string") return v;
      if (typeof v === "number") return `${v}px`;
    }
  }
  void resolveToken;
  switch (s) {
    case "sm":
      return "14px";
    case "md":
      return "16px";
    case "lg":
      return "20px";
    case "xl":
      return "28px";
    case "xxl":
      return "40px";
    default:
      return s;
  }
}

// ----- Collection helpers used by generated code -----

export type TestResult = {
  name: string;
  pass: boolean;
  expected?: string;
  actual?: string;
  diffAt?: string;
  /**
   * The scalar values at the divergence point (`diffAt`), when the runner can
   * isolate one. Powers the §8.7.1 value arrow (`expected -> actual`) and lets
   * `kumiki fix --auto-patch` find the responsible source literal.
   */
  leaf?: { expected: unknown; actual: unknown };
};

function _jsonStr(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** Deep structural equality for slot values (records / lists / primitives). */
function deepEqualValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  const aArr = Array.isArray(a);
  const bArr = Array.isArray(b);
  if (aArr || bArr) {
    if (!aArr || !bArr || a.length !== b.length) return false;
    return a.every((x, i) => deepEqualValue(x, (b as unknown[])[i]));
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao);
  if (ak.length !== Object.keys(bo).length) return false;
  // Compare key presence too — `{a: undefined}` and `{b: undefined}` have equal
  // key counts but are not equal.
  return ak.every((k) => Object.hasOwn(bo, k) && deepEqualValue(ao[k], bo[k]));
}

function tileField(node: unknown, k: string): unknown {
  return (node as Record<string, unknown> | null | undefined)?.[k];
}

function tileChildren(node: unknown): unknown[] {
  const c = tileField(node, "children");
  return Array.isArray(c) ? c.filter((x) => x != null) : [];
}

/**
 * Structural tile comparison for tile-tests: compares `kind`, `text`, and
 * `children` recursively. Props (styles, onClick handlers, …) are out of scope,
 * per spec §8.4. Returns the first differing path on mismatch.
 */
function tileStructEqual(
  expected: unknown,
  actual: unknown,
  path = "",
): { ok: boolean; path?: string; expectedLeaf?: unknown; actualLeaf?: unknown } {
  if (expected == null || actual == null) {
    return expected === actual ? { ok: true } : { ok: false, path: path || "(root)" };
  }
  const ek = tileField(expected, "kind");
  const here = path || String(ek ?? "(root)");
  if (ek !== tileField(actual, "kind")) return { ok: false, path: `${here}.kind` };
  if (tileField(expected, "text") !== undefined) {
    const et = String(tileField(expected, "text"));
    const at = String(tileField(actual, "text"));
    if (et !== at) {
      // Carry the scalar leaf values so the runner can print the §8.7.1 value
      // arrow and `kumiki fix --auto-patch` can locate the responsible literal.
      return { ok: false, path: `${here}.text`, expectedLeaf: et, actualLeaf: at };
    }
  }
  const ec = tileChildren(expected);
  const ac = tileChildren(actual);
  if (ec.length !== ac.length) return { ok: false, path: `${here}.children.length` };
  for (let i = 0; i < ec.length; i++) {
    const r = tileStructEqual(ec[i], ac[i], `${here}[${i}]`);
    if (!r.ok) return r;
  }
  return { ok: true };
}

function serializeTileNode(node: unknown): string {
  if (node == null) return "null";
  const kind = String(tileField(node, "kind"));
  const kids = tileChildren(node);
  if (tileField(node, "text") !== undefined && kids.length === 0) {
    return `${kind}(${_jsonStr(tileField(node, "text"))})`;
  }
  if (kids.length === 0) return `${kind}()`;
  return `${kind}(${kids.map(serializeTileNode).join(", ")})`;
}

export const _stdlib = {
  // ----- in-language test runner (`kumiki test`) -----
  /** Reset live slot state to slot defaults, then apply the test's `given` slots. */
  resetLive(
    live: Record<string, unknown>,
    slots: Record<string, { value: unknown }>,
    given: Record<string, unknown>,
  ): void {
    for (const k of Object.keys(live)) delete live[k];
    for (const [k, v] of Object.entries(slots)) live[k] = v.value;
    Object.assign(live, given);
  },
  /** Compare a reducer's resulting slots + emitted effects (or a panic) to `expect`. */
  runReducerTest(input: {
    name: string;
    givenSlots: Record<string, unknown>;
    result: { slots: Record<string, unknown>; emits: { effect: string; args: unknown[] }[] } | null;
    panic: string | null;
    expect:
      | { kind: "panic"; message: string }
      | {
          kind: "state";
          slots: Record<string, unknown>;
          effects: { effect: string; args: unknown[]; argsSpecified?: boolean }[];
        };
  }): TestResult {
    const { name, givenSlots, result, panic, expect } = input;
    if (expect.kind === "panic") {
      const pass = panic !== null && String(panic).includes(expect.message);
      return {
        name,
        pass,
        expected: `panic: ${_jsonStr(expect.message)}`,
        actual: panic === null ? "(no panic)" : `panic: ${_jsonStr(panic)}`,
        ...(pass ? {} : { diffAt: "(panic)" }),
      };
    }
    if (panic !== null) {
      return {
        name,
        pass: false,
        expected: _jsonStr(expect.slots),
        actual: `panic: ${_jsonStr(panic)}`,
        diffAt: "(unexpected panic)",
      };
    }
    const finalSlots = { ...givenSlots, ...(result?.slots ?? {}) };
    let diffAt: string | undefined;
    let leaf: { expected: unknown; actual: unknown } | undefined;
    for (const k of Object.keys(expect.slots)) {
      if (!deepEqualValue(finalSlots[k], expect.slots[k])) {
        diffAt = `slots.${k}`;
        leaf = { expected: expect.slots[k], actual: finalSlots[k] };
        break;
      }
    }
    const emits = result?.emits ?? [];
    if (diffAt === undefined) {
      if (emits.length !== expect.effects.length) {
        diffAt = "effects.length";
      } else {
        for (let i = 0; i < expect.effects.length; i++) {
          const ex = expect.effects[i];
          const ac = emits[i];
          if (!ex || !ac || ex.effect !== ac.effect) {
            diffAt = `effects[${i}].effect`;
            break;
          }
          // A bare effect name (`persist`) matches by name only; `persist(...)`
          // (even `persist()`) pins the exact argument list.
          if (ex.argsSpecified && !deepEqualValue(ac.args, ex.args)) {
            diffAt = `effects[${i}].args`;
            break;
          }
        }
      }
    }
    const pickExpected = (s: Record<string, unknown>): Record<string, unknown> => {
      const o: Record<string, unknown> = {};
      for (const k of Object.keys(expect.slots)) o[k] = s[k];
      return o;
    };
    return {
      name,
      pass: diffAt === undefined,
      expected: `slots=${_jsonStr(expect.slots)} effects=${_jsonStr(expect.effects.map((e) => e.effect))}`,
      actual: `slots=${_jsonStr(pickExpected(finalSlots))} effects=${_jsonStr(emits.map((e) => e.effect))}`,
      ...(diffAt ? { diffAt } : {}),
      ...(leaf ? { leaf } : {}),
    };
  },
  /** Structurally compare a rendered tile against the expected tile structure. */
  runTileTest(input: { name: string; actual: unknown; expected: unknown }): TestResult {
    const cmp = tileStructEqual(input.expected, input.actual);
    return {
      name: input.name,
      pass: cmp.ok,
      expected: serializeTileNode(input.expected),
      actual: serializeTileNode(input.actual),
      ...(cmp.path ? { diffAt: cmp.path } : {}),
      ...(cmp.expectedLeaf !== undefined || cmp.actualLeaf !== undefined
        ? { leaf: { expected: cmp.expectedLeaf, actual: cmp.actualLeaf } }
        : {}),
    };
  },
  mapSize(m: unknown): number {
    if (m instanceof Map) return m.size;
    if (m && typeof m === "object") return Object.keys(m as object).length;
    return 0;
  },
  mapKeys(m: Record<string, unknown> | undefined | null): string[] {
    return m ? Object.keys(m) : [];
  },
  mapValues(m: Record<string, unknown> | undefined | null): unknown[] {
    return m ? Object.values(m) : [];
  },
  mapEntries(m: Record<string, unknown> | undefined | null): unknown[] {
    return m ? Object.entries(m) : [];
  },
  mapGet(m: Record<string, unknown> | undefined | null, k: string): unknown {
    return m ? m[k] : undefined;
  },
  /** Polymorphic `.get-or(default)` for Option-like values. */
  getOr(v: unknown, fallback: unknown): unknown {
    if (v && typeof v === "object" && "_tag" in (v as Record<string, unknown>)) {
      const tagged = v as { _tag: string; _0?: unknown };
      if (tagged._tag === "Some" || tagged._tag === "Ok") {
        return tagged._0;
      }
      if (tagged._tag === "None" || tagged._tag === "Err") {
        return fallback;
      }
    }
    return v ?? fallback;
  },
  mapGetOr(m: Record<string, unknown> | undefined | null, k: string, def: unknown): unknown {
    if (m && k in m) return m[k];
    return def;
  },
  mapInsert(m: Record<string, unknown>, k: string, v: unknown): Record<string, unknown> {
    return { ...m, [k]: v };
  },
  mapRemove(m: Record<string, unknown>, k: string): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [kk, vv] of Object.entries(m ?? {})) if (kk !== k) out[kk] = vv;
    return out;
  },
  mapFilter(
    m: Record<string, unknown>,
    pred: (k: string, v: unknown) => boolean,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(m ?? {})) if (pred(k, v)) out[k] = v;
    return out;
  },
  /**
   * Polymorphic `.filter` dispatch — used by codegen when the receiver type
   * isn't statically known (e.g. `m.keys.filter(...)` vs `m.filter(...)`).
   * Arrays go through Array.prototype.filter; objects (Maps in Kumiki) fall
   * back to the (k, v) → boolean predicate of mapFilter.
   */
  filter(coll: unknown, pred: (...args: unknown[]) => boolean): unknown {
    if (Array.isArray(coll)) return coll.filter((x) => pred(x));
    if (coll && typeof coll === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(coll as Record<string, unknown>)) {
        if (pred(k, v)) out[k] = v;
      }
      return out;
    }
    return [];
  },
  listSize(xs: unknown[]): number {
    return xs?.length ?? 0;
  },
  listFilter<T>(xs: T[], pred: (x: T) => boolean): T[] {
    return (xs ?? []).filter(pred);
  },
  listMap<T, U>(xs: T[], fn: (x: T) => U): U[] {
    return (xs ?? []).map(fn);
  },
  /** Polymorphic `.map`: over List elements, or over Option/Result Some/Ok. */
  mapOver(coll: unknown, fn: (x: unknown) => unknown): unknown {
    if (Array.isArray(coll)) return coll.map(fn);
    if (coll && typeof coll === "object" && "_tag" in (coll as Record<string, unknown>)) {
      const tagged = coll as { _tag: string; _0?: unknown };
      if (tagged._tag === "Some") return { _tag: "Some", _0: fn(tagged._0) };
      if (tagged._tag === "Ok") return { _tag: "Ok", _0: fn(tagged._0) };
      return coll; // None / Err pass through
    }
    return coll == null ? [] : fn(coll);
  },
  /** Option(T).flat-map(f): Some(v) -> f(v), None -> None. f returns an Option. */
  flatMapOption(opt: unknown, fn: (x: unknown) => unknown): unknown {
    if (opt && typeof opt === "object" && "_tag" in (opt as Record<string, unknown>)) {
      const tagged = opt as { _tag: string; _0?: unknown };
      if (tagged._tag === "Some" || tagged._tag === "Ok") return fn(tagged._0);
      return opt; // None / Err pass through
    }
    return _stdlib.None;
  },
  listSortBy<T>(xs: T[], keyOf: (x: T) => number): T[] {
    return [...(xs ?? [])].sort((a, b) => keyOf(a) - keyOf(b));
  },
  /** List(T).fold(init, expr): left fold with $1=acc, $2=elem. */
  listFold<T, A>(xs: T[], init: A, fn: (acc: A, x: T) => A): A {
    let acc = init;
    for (const x of xs ?? []) acc = fn(acc, x);
    return acc;
  },
  setHas(s: Record<string, true> | undefined, x: unknown): boolean {
    return !!s && String(x) in s;
  },
  setToggle(s: Record<string, true> | undefined, x: unknown): Record<string, true> {
    const k = String(x);
    const cur = { ...(s ?? {}) };
    if (k in cur) {
      delete cur[k];
      return cur;
    }
    cur[k] = true;
    return cur;
  },
  add(a: unknown, b: unknown): unknown {
    if (typeof a === "string" || typeof b === "string") return String(a) + String(b);
    return (a as number) + (b as number);
  },
  show(v: unknown): string {
    if (v === null || v === undefined) return "";
    if (typeof v === "object" && v && "_tag" in v) {
      const obj = v as { _tag: string };
      return obj._tag;
    }
    return String(v);
  },
  eq(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a === "object" && typeof b === "object") {
      const ao = a as { _tag?: string };
      const bo = b as { _tag?: string };
      if (ao._tag !== undefined || bo._tag !== undefined) {
        if (ao._tag !== bo._tag) return false;
        for (const k of Object.keys(ao)) {
          if (!Object.is((ao as Record<string, unknown>)[k], (bo as Record<string, unknown>)[k])) {
            return false;
          }
        }
        return true;
      }
    }
    return false;
  },
  freshId(): string {
    const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
    if (c?.randomUUID) return c.randomUUID();
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  },
  now(): number {
    return Date.now();
  },
  recordCopy(
    rec: Record<string, unknown>,
    patch: Record<string, unknown>,
  ): Record<string, unknown> {
    return { ...rec, ...patch };
  },
  /**
   * `.get` — the polymorphic unwrap for Option AND Result. Per docs/spec/stdlib.md
   * §2.2 it PANICS on the empty case (`None` / `Err`); `Some(v)` / `Ok(v)`
   * unwrap to `v`. A plain (non-variant) value passes through unchanged. (Before
   * v0.3 this returned the value unchanged on the empty case, so `.get` and
   * `.get-err` behaved oppositely — #24.)
   */
  unwrap(opt: unknown): unknown {
    if (opt && typeof opt === "object" && "_tag" in opt) {
      const o = opt as { _tag: string; _0?: unknown };
      if (o._tag === "Some" || o._tag === "Ok") return o._0;
      if (o._tag === "None") throw new KumikiPanic("get called on None");
      if (o._tag === "Err") throw new KumikiPanic("get called on an Err value");
    }
    return opt;
  },
  /** `panic(message)` — raise Kumiki's controlled stop-the-program signal. */
  panic(message: unknown): never {
    throw new KumikiPanic(String(message));
  },
  optionGetOr(opt: unknown, def: unknown): unknown {
    if (opt && typeof opt === "object" && "_tag" in opt) {
      const o = opt as { _tag: string; _0?: unknown };
      if (o._tag === "Some") return o._0;
      if (o._tag === "None") return def;
    }
    return opt ?? def;
  },
  Some(v: unknown): { _tag: "Some"; _0: unknown } {
    return { _tag: "Some", _0: v };
  },
  None: { _tag: "None" as const },
  Ok(v: unknown): { _tag: "Ok"; _0: unknown } {
    return { _tag: "Ok", _0: v };
  },
  Err(v: unknown): { _tag: "Err"; _0: unknown } {
    return { _tag: "Err", _0: v };
  },
  variant(tag: string, ...args: unknown[]): { _tag: string; [k: string]: unknown } {
    const o: { _tag: string; [k: string]: unknown } = { _tag: tag };
    args.forEach((a, i) => {
      o[`_${i}`] = a;
    });
    return o;
  },
  variantIs(v: unknown, tag: string): boolean {
    return !!v && typeof v === "object" && "_tag" in v && (v as { _tag: string })._tag === tag;
  },

  // ----- Issue #5: collection / value helpers for the stdlib methods that the
  // codegen now lowers to `_s.*` calls. See docs/spec/stdlib.md §2.2. -----

  /** List(T).chunk(n) → List(List(T)). The last chunk may be shorter. */
  listChunk(xs: unknown[] | undefined | null, n: number): unknown[] {
    const arr = xs ?? [];
    const size = Math.max(1, Math.floor(n));
    const out: unknown[] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  },
  /** List(T).zip(other) → List(Tuple(T, U)); truncates to the shorter list. */
  listZip(a: unknown[] | undefined | null, b: unknown[] | undefined | null): unknown[] {
    const xs = a ?? [];
    const ys = b ?? [];
    const n = Math.min(xs.length, ys.length);
    const out: unknown[] = [];
    for (let i = 0; i < n; i++) out.push([xs[i], ys[i]]);
    return out;
  },
  /** Map(K,V).update(k, fn): apply fn to the current value of k, no-op if absent. */
  mapUpdate(
    m: Record<string, unknown> | undefined | null,
    k: string,
    fn: (v: unknown) => unknown,
  ): Record<string, unknown> {
    const obj = m ?? {};
    if (!(k in obj)) return obj;
    return { ...obj, [k]: fn(obj[k]) };
  },
  /** Set(T).add(x). Sets are stored as `{ [String(x)]: true }`. */
  setAdd(s: Record<string, true> | undefined | null, x: unknown): Record<string, true> {
    return { ...(s ?? {}), [String(x)]: true };
  },
  /** Set(T).union(other). */
  setUnion(
    a: Record<string, true> | undefined | null,
    b: Record<string, true> | undefined | null,
  ): Record<string, true> {
    return { ...(a ?? {}), ...(b ?? {}) };
  },
  /** Set(T).intersect(other) — keys present in both. */
  setIntersect(
    a: Record<string, true> | undefined | null,
    b: Record<string, true> | undefined | null,
  ): Record<string, true> {
    const bb = b ?? {};
    const out: Record<string, true> = {};
    for (const k of Object.keys(a ?? {})) if (k in bb) out[k] = true;
    return out;
  },
  /** Set(T).diff(other) — keys in a not in b. */
  setDiff(
    a: Record<string, true> | undefined | null,
    b: Record<string, true> | undefined | null,
  ): Record<string, true> {
    const bb = b ?? {};
    const out: Record<string, true> = {};
    for (const k of Object.keys(a ?? {})) if (!(k in bb)) out[k] = true;
    return out;
  },
  /** Option(T).or / Result(T,E).or — receiver when Some/Ok, else `other`. */
  or(v: unknown, other: unknown): unknown {
    if (v && typeof v === "object" && "_tag" in (v as Record<string, unknown>)) {
      const tag = (v as { _tag: string })._tag;
      if (tag === "Some" || tag === "Ok") return v;
      if (tag === "None" || tag === "Err") return other;
    }
    return v ?? other;
  },
  /** Result(T,E).map-err(fn) — maps the Err payload, passes Ok through unchanged. */
  mapErr(r: unknown, fn: (e: unknown) => unknown): unknown {
    if (r && typeof r === "object" && "_tag" in (r as Record<string, unknown>)) {
      const t = r as { _tag: string; _0?: unknown };
      if (t._tag === "Err") return { _tag: "Err", _0: fn(t._0) };
    }
    return r;
  },
  /** Polymorphic `.diff`: numeric magnitude (Time/Duration) or Set difference. */
  diff(a: unknown, b: unknown): unknown {
    if (typeof a === "number" || typeof b === "number") {
      return Math.abs((a as number) - (b as number));
    }
    return _stdlib.setDiff(a as Record<string, true>, b as Record<string, true>);
  },

  // ----- Issue #7: argument-less spec stdlib methods (docs/spec/stdlib.md §2.2).
  // Callable both parenthesis-free (`xs.head`) and parenthesized (`xs.head()`);
  // codegen lowers both shapes to these. -----

  /** List(T).head → Option(T). */
  listHead(xs: unknown[] | undefined | null): unknown {
    const a = xs ?? [];
    return a.length > 0 ? _stdlib.Some(a[0]) : _stdlib.None;
  },
  /** List(T).tail → List(T) (all but the first; empty list stays empty). */
  listTail(xs: unknown[] | undefined | null): unknown[] {
    return (xs ?? []).slice(1);
  },
  /** List(T).last → Option(T). */
  listLast(xs: unknown[] | undefined | null): unknown {
    const a = xs ?? [];
    return a.length > 0 ? _stdlib.Some(a[a.length - 1]) : _stdlib.None;
  },
  /** Set(T).to-list / Option(T).to-list → List(T). */
  toList(v: unknown): unknown[] {
    if (v && typeof v === "object" && "_tag" in (v as Record<string, unknown>)) {
      // Option: Some(x) → [x], None → [].
      const o = v as { _tag: string; _0?: unknown };
      return o._tag === "Some" ? [o._0] : [];
    }
    // Return a fresh copy so the result never aliases a slot array, matching
    // listHead/listTail/listLast which all produce new values.
    if (Array.isArray(v)) return [...v];
    // Set is stored as `{ [key]: true }` (keys are stringified, like the other set ops).
    if (v && typeof v === "object") return Object.keys(v as Record<string, unknown>);
    return [];
  },
  /** Result(T,E).get-err → E; panics (KumikiPanic) if the value is Ok. */
  getErr(r: unknown): unknown {
    if (r && typeof r === "object" && "_tag" in (r as Record<string, unknown>)) {
      const t = r as { _tag: string; _0?: unknown };
      if (t._tag === "Err") return t._0;
    }
    throw new KumikiPanic("get-err called on a non-Err value");
  },
  /** Result(T,E).to-option → Option(T): Ok(v) → Some(v), Err(_) → None. */
  toOption(r: unknown): unknown {
    if (r && typeof r === "object" && "_tag" in (r as Record<string, unknown>)) {
      const t = r as { _tag: string; _0?: unknown };
      if (t._tag === "Ok") return _stdlib.Some(t._0);
    }
    return _stdlib.None;
  },
  /** Text.parse-int → Option(Int) (truncates; mirrors `Int.parse`). */
  parseIntOpt(s: unknown): unknown {
    const n = Number(s);
    return String(s).trim() !== "" && Number.isFinite(n)
      ? _stdlib.Some(Math.trunc(n))
      : _stdlib.None;
  },
  /** Text.parse-float → Option(Float) (mirrors `Float.parse`). */
  parseFloatOpt(s: unknown): unknown {
    const n = Number(s);
    return String(s).trim() !== "" && Number.isFinite(n) ? _stdlib.Some(n) : _stdlib.None;
  },
};

// ----- Built-in capability handlers -----

export const builtinEffects = {
  async storageRead(input: unknown): Promise<EffectResult> {
    const { key } = input as { key: string };
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return { kind: "ok", value: _stdlib.None };
      const value = JSON.parse(raw);
      return { kind: "ok", value: _stdlib.Some(value) };
    } catch (e) {
      return { kind: "err", value: { message: String(e) } };
    }
  },
  async storageWrite(input: unknown): Promise<EffectResult> {
    const { key, value } = input as { key: string; value: unknown };
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return { kind: "ok", value: null };
    } catch (e) {
      return { kind: "err", value: { message: String(e) } };
    }
  },
  async httpFetch(method: string, input: unknown, baseUrl: string): Promise<EffectResult> {
    const x = input as {
      url?: string;
      headers?: Record<string, string>;
      body?: unknown;
      decode?: string;
      key?: string;
      value?: unknown;
    };
    const url = (baseUrl ?? "") + (x.url ?? "");
    const init: RequestInit = { method, headers: { ...(x.headers ?? {}) } };
    if (x.body !== undefined && method !== "GET" && method !== "HEAD") {
      const headers = init.headers as Record<string, string>;
      if (typeof x.body === "string") {
        init.body = x.body;
      } else {
        init.body = JSON.stringify(x.body);
        if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
      }
    }
    try {
      const res = await fetch(url, init);
      if (res.status === 401 || res.status === 403 || res.status >= 500) {
        return {
          kind: "err",
          value: {
            status: res.status,
            message: res.statusText,
            body: await res.text().catch(() => ""),
          },
        };
      }
      if (!res.ok) {
        return {
          kind: "err",
          value: {
            status: res.status,
            message: res.statusText,
            body: await res.text().catch(() => ""),
          },
        };
      }
      const decode = x.decode ?? "json";
      let value: unknown;
      if (decode === "json") value = await res.json();
      else if (decode === "text") value = await res.text();
      else if (decode === "none") value = null;
      else value = await res.text();
      return { kind: "ok", value };
    } catch (e) {
      return { kind: "err", value: { status: 0, message: String(e), body: "" } };
    }
  },
};
