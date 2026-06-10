// storage.* built-in capability handlers (#71): shipped only when an app
// declares a storage-backed effect.

import type { EffectResult } from "./core.ts";
import { _stdlibCore } from "./stdlib.ts";

export async function storageRead(input: unknown): Promise<EffectResult> {
  const { key } = input as { key: string };
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return { kind: "ok", value: _stdlibCore.None };
    const value = JSON.parse(raw);
    return { kind: "ok", value: _stdlibCore.Some(value) };
  } catch (e) {
    return { kind: "err", value: { message: String(e) } };
  }
}

export async function storageWrite(input: unknown): Promise<EffectResult> {
  const { key, value } = input as { key: string; value: unknown };
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { kind: "ok", value: null };
  } catch (e) {
    return { kind: "err", value: { message: String(e) } };
  }
}
