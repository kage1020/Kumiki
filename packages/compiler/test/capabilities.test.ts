import { check, lex, parse, parseCapabilityManifest } from "@kumikijs/compiler";
import { describe, expect, it } from "vitest";

const checkSrc = (src: string, capabilities?: string[]) => check(parse(lex(src)), { capabilities });

const appWith = (caps: string): string => `
  slot x : Int = 0
  reducer r on=ui.click(B) do= x := x + 1
  tile B = button(text="b")
  tile App = column(B, text(x.show))
  app A caps=${caps} routes={"/" -> App, "/404" -> App} init=[]
`;

describe("capability manifest parsing", () => {
  it("accepts a list of string capability names", () => {
    const r = parseCapabilityManifest({ capabilities: ["telemetry.track", "telemetry.identify"] });
    expect(r).toEqual({
      ok: true,
      manifest: { capabilities: ["telemetry.track", "telemetry.identify"] },
    });
  });

  it("accepts object entries with a name", () => {
    const r = parseCapabilityManifest({
      capabilities: [{ name: "telemetry.track", description: "x" }],
    });
    expect(r.ok && r.manifest.capabilities).toEqual(["telemetry.track"]);
  });

  it("rejects a non-object manifest", () => {
    expect(parseCapabilityManifest([]).ok).toBe(false);
    expect(parseCapabilityManifest(null).ok).toBe(false);
  });

  it("rejects a missing or non-array capabilities field", () => {
    expect(parseCapabilityManifest({}).ok).toBe(false);
    expect(parseCapabilityManifest({ capabilities: "x" }).ok).toBe(false);
  });

  it("rejects a malformed capability name", () => {
    const r = parseCapabilityManifest({ capabilities: ["NotValid"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("group.action");
  });

  it("rejects re-declaring a standard capability", () => {
    expect(parseCapabilityManifest({ capabilities: ["storage.write"] }).ok).toBe(false);
  });
});

describe("capability checking (E0302)", () => {
  it("accepts standard capabilities", () => {
    expect(checkSrc(appWith("[storage.write, nav.push]")).some((e) => e.code === "E0302")).toBe(
      false,
    );
  });

  it("rejects an unknown capability", () => {
    const errs = checkSrc(appWith("[bogus.thing]"));
    expect(errs.some((e) => e.code === "E0302" && e.message.includes("bogus.thing"))).toBe(true);
  });

  it("accepts a registered (manifest) capability passed via opts", () => {
    expect(
      checkSrc(appWith("[telemetry.track]"), ["telemetry.track"]).some((e) => e.code === "E0302"),
    ).toBe(false);
  });

  it("still rejects a capability that is neither standard nor registered", () => {
    expect(
      checkSrc(appWith("[telemetry.track]"), ["telemetry.identify"]).some(
        (e) => e.code === "E0302",
      ),
    ).toBe(true);
  });
});
