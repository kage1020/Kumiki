// http.* built-in capability handler (#71): shipped only when an app declares
// an HTTP-backed effect.

import type { EffectResult } from "./core.ts";

export async function httpFetch(
  method: string,
  input: unknown,
  baseUrl: string,
): Promise<EffectResult> {
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
}
