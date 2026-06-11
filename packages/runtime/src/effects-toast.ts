// The `toast` built-in effect (#71): shipped only when an app can emit it
// (declares the notification.show capability or emits `toast`).

import { type BuiltinInstaller, overridableInvoke } from "./core.ts";

export const installToast: BuiltinInstaller = (app) => {
  app.effects.toast = {
    name: "toast",
    cap: "notification.show",
    invoke: overridableInvoke("notification.show", async (input) => {
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
};
