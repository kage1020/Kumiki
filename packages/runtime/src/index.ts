// Strand v0.1 runtime — Phase 3 browser runtime.

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
      kind: "grid" | "stack" | "region" | "scroll" | "panel" | "fieldset";
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
    | { kind: "timer"; intervalMs: number }
    | { kind: "lifecycle"; name: string };
  apply: (
    slots: Record<string, unknown>,
    payload: Record<string, unknown>,
  ) => { slots: Record<string, unknown>; emits: EmitSpec[] };
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

export type CapabilityRegistry = {
  has(cap: string): boolean;
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

function parseLocation(routes: AppShape["routes"], loc: Location): ParsedRoute {
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

export function mount(app: AppShape, target: HTMLElement): { dispose: () => void } {
  if (!app.live) {
    app.live = {};
    for (const [k, v] of Object.entries(app.slots)) app.live[k] = v.value;
  }
  // Ensure `route` slot exists (auto-managed by runtime when routes are declared).
  if (!("route" in app.live)) {
    app.live.route = emptyRoute();
  }
  const slotValues = app.live;

  const caps = makeCapabilityRegistry(app.caps);
  const dispatcher = makeEffectDispatcher(app, caps, (effect, outcome, value, key) => {
    handleEffectResult(effect, outcome, value, key);
  });

  let currentRoot: HTMLElement | null = null;
  let disposed = false;
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
        bind: el.dataset.strandBind ?? undefined,
        id: el.id || undefined,
        path: domPath(el, target),
        selStart: el.selectionStart,
        selEnd: el.selectionEnd,
      };
    }

    maybeReapplyTheme(app);
    const tree = pickRootTile(app);
    const dom = renderTile(tree);
    if (currentRoot) target.replaceChild(dom, currentRoot);
    else target.appendChild(dom);
    currentRoot = dom;

    if (snap) {
      let sel: Element | null = snap.bind
        ? target.querySelector(`[data-strand-bind="${snap.bind}"]`)
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

  function applyReducer(r: ReducerSpec, payload: Record<string, unknown>): void {
    if (disposed) return;
    const result = r.apply(slotValues, payload);
    for (const [k, v] of Object.entries(result.slots)) {
      const meta = app.slots[k];
      if (meta?.refine && !meta.refine(v)) continue;
      slotValues[k] = v;
    }
    for (const emit of result.emits) dispatcher.dispatch(emit);
    render();
  }

  function handleEffectResult(
    effect: string,
    outcome: "ok" | "err",
    value: unknown,
    key: unknown,
  ): void {
    for (const r of app.reducers) {
      if (r.event.kind === "effect" && r.event.effect === effect && r.event.outcome === outcome) {
        applyReducer(r, { $1: value, $2: key });
      }
    }
  }

  function updateRoute(newPath: string, replace: boolean): void {
    if (replace) history.replaceState(null, "", newPath);
    else history.pushState(null, "", newPath);
    syncRouteFromLocation();
  }

  function syncRouteFromLocation(): void {
    const oldRoute = slotValues.route as ParsedRoute;
    const newRoute = parseLocation(app.routes, location);
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
    () => slotValues,
    () => render(),
  );

  // Apply theme defaults to <body> and inject base CSS for tile primitives.
  // Reset the cache so subsequent mounts (e.g. across parallel tests) always
  // re-bind the global `__strandApp` reference, even if the theme name matches.
  lastAppliedThemeName = null;
  applyThemeDefaults(app);
  lastAppliedThemeName =
    (app.live?.[app.themeName ?? ""] as string | undefined) ?? app.themeName ?? null;

  // Initial route sync — but first check for a static redirect on the current path.
  if (app.routes && app.routes.length > 0) {
    let redirected = false;
    for (const r of app.routes) {
      if ("redirectTo" in r && matchPattern(r.pattern, location.pathname)) {
        history.replaceState(null, "", r.redirectTo);
        redirected = true;
        break;
      }
    }
    void redirected;
    slotValues.route = parseLocation(app.routes, location);
    window.addEventListener("popstate", () => syncRouteFromLocation());
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
  // Start timer reducers — each fires its reducer every intervalMs.
  const timerHandles: ReturnType<typeof setInterval>[] = [];
  for (const r of app.reducers) {
    if (r.event.kind === "timer") {
      const handle = setInterval(() => applyReducer(r, {}), r.event.intervalMs);
      timerHandles.push(handle);
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
      for (const h of timerHandles) clearInterval(h);
      target.replaceChildren();
      dispatcher.dispose();
    },
  };
}

function makeCapabilityRegistry(allowed: string[]): CapabilityRegistry {
  const ok = new Set(allowed);
  return { has: (c) => ok.has(c) };
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
  getLive: () => Record<string, unknown>,
  rerender: () => void,
): void {
  app.effects.navigate = {
    name: "navigate",
    cap: "nav.push",
    invoke: async (input) => {
      const x = input as {
        path: string;
        params?: Record<string, string>;
        query?: Record<string, string>;
      };
      navigate(buildPath(x), false);
      return { kind: "ok", value: null };
    },
  };
  app.effects["navigate-replace"] = {
    name: "navigate-replace",
    cap: "nav.replace",
    invoke: async (input) => {
      const x = input as {
        path: string;
        params?: Record<string, string>;
        query?: Record<string, string>;
      };
      navigate(buildPath(x), true);
      return { kind: "ok", value: null };
    },
  };
  app.effects["navigate-back"] = {
    name: "navigate-back",
    cap: "nav.back",
    invoke: async () => {
      history.back();
      return { kind: "ok", value: null };
    },
  };
  app.effects.toast = {
    name: "toast",
    cap: "notification.show",
    invoke: async (input) => {
      const t = input as { kind?: string; text?: string };
      const banner = document.createElement("div");
      banner.style.cssText =
        "position:fixed;bottom:24px;right:24px;padding:8px 16px;background:#1a1a1a;color:#fff;border-radius:8px;z-index:9999;";
      banner.textContent = t.text ?? "";
      document.body.appendChild(banner);
      setTimeout(() => banner.remove(), 3000);
      return { kind: "ok", value: null };
    },
  };
  app.effects.log = {
    name: "log",
    cap: "log.write",
    invoke: async (input) => {
      console.log("[strand]", input);
      return { kind: "ok", value: null };
    },
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

function renderTile(node: TileNode): HTMLElement {
  switch (node.kind) {
    case "page":
    case "column": {
      const div = document.createElement("div");
      div.dataset.strandTile = node.kind;
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
      div.dataset.strandTile = "row";
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
      div.dataset.strandTile = node.kind;
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
    case "grid": {
      const div = document.createElement("div");
      div.dataset.strandTile = "grid";
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
      hr.dataset.strandTile = "divider";
      return hr;
    }
    case "heading": {
      const h = document.createElement("h1");
      h.dataset.strandTile = "heading";
      h.textContent = node.text;
      applyTextProps(h, node.props);
      return h;
    }
    case "text": {
      const span = document.createElement("span");
      span.dataset.strandTile = "text";
      span.textContent = node.text;
      applyTextProps(span, node.props);
      return span;
    }
    case "button": {
      const b = document.createElement("button");
      b.dataset.strandTile = "button";
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
      inp.dataset.strandTile = "input";
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
        inp.dataset.strandBind = fullPath;
      }
      inp.value = node.value ?? "";
      if (node.bind) {
        const slotName = node.bind;
        const bindPath = node.bindPath;
        inp.addEventListener("input", () => {
          const win = window as unknown as { __strandApp?: AppShape };
          const app = win.__strandApp as AppShape & {
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
      ta.dataset.strandTile = "textarea";
      if (node.rows) ta.rows = node.rows;
      if (node.placeholder) ta.placeholder = node.placeholder;
      if (node.id) ta.id = node.id;
      if (node.bind) {
        const fullPath =
          node.bindPath && node.bindPath.length > 0
            ? `${node.bind}.${node.bindPath.join(".")}`
            : node.bind;
        ta.dataset.strandBind = fullPath;
      }
      ta.value = node.value ?? "";
      if (node.bind) {
        const slotName = node.bind;
        const bindPath = node.bindPath;
        ta.addEventListener("input", () => {
          const win = window as unknown as { __strandApp?: AppShape };
          const app = win.__strandApp as AppShape & {
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
      wrap.dataset.strandTile = "check";
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
      span.dataset.strandTile = "spinner";
      span.textContent = "…";
      return span;
    }
    case "select": {
      const sel = document.createElement("select");
      sel.dataset.strandTile = "select";
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
        const win = window as unknown as { __strandApp?: AppShape };
        const app = win.__strandApp as AppShape & {
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
      wrap.dataset.strandTile = "radio";
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
      div.dataset.strandTile = "skeleton";
      div.style.background = "#eee";
      div.style.borderRadius = "8px";
      div.style.minHeight = "60px";
      const h = node.props?.h;
      if (typeof h === "number") div.style.height = `${h}px`;
      return div;
    }
    case "form": {
      const form = document.createElement("form");
      form.dataset.strandTile = "form";
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
      lbl.dataset.strandTile = "label";
      lbl.textContent = node.text;
      const forAttr = node.props?.for;
      if (typeof forAttr === "string") lbl.htmlFor = forAttr;
      return lbl;
    }
    case "link": {
      const a = document.createElement("a");
      a.dataset.strandTile = "link";
      a.href = node.to;
      a.textContent = node.text;
      a.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        const win = window as unknown as { __strandApp?: AppShape };
        const nav = (win.__strandApp as AppShape & { _navigate?: (p: string, r?: boolean) => void })
          ?._navigate;
        if (nav) nav(node.to, false);
      });
      return a;
    }
    case "markdown": {
      const div = document.createElement("div");
      div.dataset.strandTile = "markdown";
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
      img.dataset.strandTile = "image";
      img.src = node.src;
      const alt = node.props?.alt;
      if (typeof alt === "string") img.alt = alt;
      return img;
    }
    case "icon": {
      const span = document.createElement("span");
      span.dataset.strandTile = "icon";
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

let animationStylesInjected = false;
function ensureAnimationStyles(): void {
  if (animationStylesInjected) return;
  animationStylesInjected = true;
  const css = `
@keyframes strand-fade { from { opacity: 0 } to { opacity: 1 } }
@keyframes strand-slide-up { from { transform: translateY(8px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
@keyframes strand-slide-down { from { transform: translateY(-8px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
.strand-anim { animation-fill-mode: both; animation-timing-function: ease; animation-duration: 300ms; }
.strand-anim-fade { animation-name: strand-fade; }
.strand-anim-slide-up { animation-name: strand-slide-up; }
.strand-anim-slide-down { animation-name: strand-slide-down; }
.strand-anim-fast { animation-duration: 150ms; }
.strand-anim-normal { animation-duration: 300ms; }
.strand-anim-slow { animation-duration: 600ms; }
`;
  const style = document.createElement("style");
  style.id = "strand-animations";
  style.appendChild(document.createTextNode(css));
  document.head.appendChild(style);
}

function applyTransition(el: HTMLElement, props?: TileProps): void {
  if (!props) return;
  const t = props.transition;
  if (typeof t !== "string") return;
  ensureAnimationStyles();
  el.classList.add("strand-anim", `strand-anim-${t}`);
  const d = props["transition-duration"];
  if (typeof d === "string") el.classList.add(`strand-anim-${d}`);
}

let stateStyleSeq = 0;
let stateStylesEl: HTMLStyleElement | null = null;

function applyStateStyles(el: HTMLElement, props: TileProps): void {
  for (const state of ["hover", "focus", "active", "disabled", "selected"] as const) {
    const sub = props[state];
    if (!sub || typeof sub !== "object" || Array.isArray(sub)) continue;
    const id = `s${++stateStyleSeq}`;
    el.dataset.strandState = el.dataset.strandState ? `${el.dataset.strandState} ${id}` : id;
    const decls = stateStyleDecls(sub as Record<string, unknown>);
    if (!stateStylesEl) {
      stateStylesEl = document.createElement("style");
      stateStylesEl.id = "strand-state-styles";
      document.head.appendChild(stateStylesEl);
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
              : "[data-strand-selected]";
    stateStylesEl.appendChild(
      document.createTextNode(`[data-strand-state~="${id}"]${selector} { ${decls} }\n`),
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
  // We need __strandApp set before currentTheme() works.
  (window as unknown as { __strandApp?: AppShape }).__strandApp = app;
  const theme = currentTheme();
  if (!theme) return;
  const colors = (theme.colors ?? {}) as Record<string, ThemeValue>;
  const typography = (theme.typography ?? {}) as Record<string, ThemeValue>;
  const sizes = (typography.size ?? {}) as Record<string, ThemeValue>;
  if (typeof colors.bg === "string") document.body.style.background = colors.bg;
  if (typeof colors.fg === "string") document.body.style.color = colors.fg;
  if (typeof typography.family === "string")
    document.body.style.fontFamily = typography.family as string;
  if (typeof sizes.md === "string") document.body.style.fontSize = sizes.md as string;
  if (typeof typography["line-height"] === "string")
    document.body.style.lineHeight = String(typography["line-height"]);
  // Inject CSS for primitives that need theme tokens.
  // Remove any prior injection first so re-renders (e.g. theme switching) don't
  // accumulate <style> nodes in document.head.
  const prior = document.getElementById("strand-theme-base");
  if (prior) prior.remove();
  const css = document.createElement("style");
  css.id = "strand-theme-base";
  css.appendChild(
    document.createTextNode(`
[data-strand-tile="card"] {
  background: ${typeof colors.surface === "string" ? colors.surface : "#fff"};
  border: 1px solid ${typeof colors.border === "string" ? colors.border : "#e0e0e0"};
  box-shadow: ${themeShadow(theme, "sm") ?? "0 1px 2px rgba(0,0,0,0.08)"};
}
[data-strand-tile="button"] {
  background: ${typeof colors.surface === "string" ? colors.surface : "#fff"};
  color: ${typeof colors.fg === "string" ? colors.fg : "#1a1a1a"};
  border: 1px solid ${typeof colors.border === "string" ? colors.border : "#ddd"};
  padding: 6px 12px;
  cursor: pointer;
  border-radius: ${themeRadius(theme, "md") ?? "8px"};
}
[data-strand-tile="button"]:hover { filter: brightness(0.97); }
[data-strand-tile="input"], [data-strand-tile="textarea"] {
  font: inherit;
  padding: 6px 10px;
  border: 1px solid ${typeof colors.border === "string" ? colors.border : "#ddd"};
  border-radius: ${themeRadius(theme, "sm") ?? "4px"};
  background: ${typeof colors.surface === "string" ? colors.surface : "#fff"};
  color: ${typeof colors.fg === "string" ? colors.fg : "#1a1a1a"};
}
[data-strand-tile="input"]:focus, [data-strand-tile="textarea"]:focus {
  outline: 2px solid ${typeof colors.primary === "string" ? colors.primary : "#0070f3"};
  outline-offset: 1px;
}
[data-strand-tile="link"] {
  color: ${typeof colors.primary === "string" ? colors.primary : "#0070f3"};
  text-decoration: none;
}
[data-strand-tile="link"]:hover { text-decoration: underline; }
[data-strand-tile="heading"] {
  font-size: ${typeof sizes.xl === "string" ? sizes.xl : "28px"};
  font-weight: 700;
  margin: 0 0 8px;
}
[data-strand-tile="markdown"] p { margin: 0 0 12px; }
`),
  );
  document.head.appendChild(css);
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
  const win = window as unknown as { __strandApp?: AppShape };
  const app = win.__strandApp;
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

export const _stdlib = {
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
   * Arrays go through Array.prototype.filter; objects (Maps in Strand) fall
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
  unwrap(opt: unknown): unknown {
    if (opt && typeof opt === "object" && "_tag" in opt) {
      const o = opt as { _tag: string; _0?: unknown };
      if (o._tag === "Some") return o._0;
    }
    return opt;
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
