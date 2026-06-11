// WebMCP playground tools — registration lifecycle kept OUT of the Vue
// component. `navigator.modelContext` is page-global and current Chrome does
// not unregister tools when the AbortSignal passed to registerTool aborts, so
// registering from onMounted made any SPA revisit of the playground page throw
// InvalidStateError "Duplicate tool name". The host registers the tools at
// most once per page load and routes execute() to whichever playground
// instance is currently mounted.

export interface PlaygroundApi {
  compileSource(source: string): unknown;
  listExamples(): string[];
  loadExample(name: string): boolean;
  setSource(source: string): unknown;
}

export interface WebMcpTool {
  name: string;
  description: string;
  inputSchema?: object;
  annotations?: { readOnlyHint?: boolean };
  execute: (input: Record<string, unknown>) => unknown;
}

export interface ModelContext {
  registerTool(tool: WebMcpTool, options?: object): void;
  unregisterTool?(name: string): void;
}

export interface PlaygroundToolHost {
  bind(mc: ModelContext | undefined, api: PlaygroundApi): void;
  release(api: PlaygroundApi): void;
}

export function createPlaygroundToolHost(): PlaygroundToolHost {
  let active: PlaygroundApi | null = null;
  let registered = false;
  let context: ModelContext | null = null;

  const notMounted = () => ({
    ok: false,
    error: "playground is not mounted; open the Playground page first",
  });

  const tools: WebMcpTool[] = [
    {
      name: "kumiki_compile",
      description:
        "Compile the given Kumiki source. Returns ok plus generated JS size, or a list of diagnostics (codes per spec/errors.md).",
      annotations: { readOnlyHint: true },
      inputSchema: {
        type: "object",
        properties: { source: { type: "string", description: "Kumiki source text" } },
        required: ["source"],
      },
      execute: (input) =>
        active ? active.compileSource(String(input.source ?? "")) : notMounted(),
    },
    {
      name: "kumiki_list_examples",
      description: "List the feature examples available in the playground.",
      annotations: { readOnlyHint: true },
      inputSchema: { type: "object", properties: {} },
      execute: () => (active ? active.listExamples() : notMounted()),
    },
    {
      name: "kumiki_load_example",
      description: "Load a named feature example into the playground editor and preview it.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "Example file name, e.g. 07-list.kumiki" },
        },
        required: ["name"],
      },
      execute: (input) => {
        if (!active) return notMounted();
        const name = String(input.name ?? "");
        return active.loadExample(name) ? `loaded ${name}` : `not found: ${name}`;
      },
    },
    {
      name: "kumiki_set_source",
      description:
        "Replace the playground editor's source with the given Kumiki code and preview it.",
      inputSchema: {
        type: "object",
        properties: { source: { type: "string" } },
        required: ["source"],
      },
      execute: (input) => (active ? active.setSource(String(input.source ?? "")) : notMounted()),
    },
  ];

  return {
    bind(mc, api) {
      active = api;
      if (registered || !mc?.registerTool) return;
      registered = true;
      context = mc;
      for (const tool of tools) mc.registerTool(tool);
    },
    release(api) {
      // A stale instance must never detach the active one — during an SPA page
      // swap the new playground can bind before the old one's teardown runs.
      if (active !== api) return;
      active = null;
      // Spec-compliant contexts let us unregister; there the tools disappear
      // with the page and the next bind re-registers. Without it the tools
      // stay registered (harmless: execute reports "not mounted").
      if (registered && context?.unregisterTool) {
        for (const tool of tools) context.unregisterTool(tool.name);
        registered = false;
        context = null;
      }
    },
  };
}

// Page-global host shared by every Playground mount in this document.
export const playgroundToolHost: PlaygroundToolHost = createPlaygroundToolHost();
