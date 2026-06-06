// Minimal static file server for Kumiki demos.
// Supports:
//  - SPA fallback (any unknown path → index.html)
//  - JSON-suffix fallback (/api/posts → /api/posts.json)
//  - GET only for /api/*; other methods get 405
// Usage: node scripts/serve.mjs <root-dir> <port>

import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? "./");
const port = Number(process.argv[3] ?? "5174");

const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

createServer((req, res) => {
  const p = decodeURIComponent((req.url ?? "/").split("?")[0]);

  if (p.startsWith("/api/")) {
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405);
      res.end("method not allowed");
      return;
    }
  }

  const candidates = [p, `${p}.json`, p === "/" ? "/index.html" : `${p}/index.html`];
  for (const c of candidates) {
    const file = join(root, c);
    if (!file.startsWith(root)) continue;
    if (existsSync(file) && statSync(file).isFile()) {
      res.writeHead(200, { "Content-Type": mime[extname(file)] ?? "text/plain" });
      res.end(readFileSync(file));
      return;
    }
  }

  // SPA fallback: only for HTML navigation requests, never for asset paths
  // with a known file extension (.js/.css/.png/etc).
  const hasFileExt = /\.[a-z0-9]{1,8}$/i.test(p);
  const accepts = req.headers.accept ?? "";
  const wantsHtml = accepts.includes("text/html");
  if (!p.startsWith("/api/") && !hasFileExt && wantsHtml) {
    const fallback = join(root, "index.html");
    if (existsSync(fallback)) {
      res.writeHead(200, { "Content-Type": mime[".html"] });
      res.end(readFileSync(fallback));
      return;
    }
  }

  res.writeHead(404);
  res.end("not found");
}).listen(port, () => {
  console.log(`serving ${root} on http://localhost:${port}`);
});
