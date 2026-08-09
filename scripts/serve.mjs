#!/usr/bin/env node
// Minimal static file server for the FetchCPU-Pocho simulator.
// Replaces `python3 -m http.server` so we don't depend on Python process handling.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".mjs":  "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".svg":  "image/svg+xml",
  ".json": "application/json",
  ".txt":  "text/plain; charset=utf-8",
  ".md":   "text/markdown; charset=utf-8",
  ".fcpu":  "text/plain; charset=utf-8",
};

const server = http.createServer((req, res) => {
  // Malformed percent-encoded URLs (e.g. "%FF") throw inside decodeURIComponent;
  // surface a 400 instead of crashing the request handler.
  let urlPath;
  try {
    urlPath = decodeURIComponent(req.url.split("?")[0]);
  } catch {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Bad request: malformed URL");
    return;
  }
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(ROOT, urlPath);
  // Real path containment: `path.relative` returns a path that starts
  // with ".." if (and only if) the resolved path escapes ROOT. The
  // `startsWith(ROOT)` check was vulnerable to symlink-style tricks
  // (e.g. /root-evil).
  const rel = path.relative(ROOT, filePath);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    res.writeHead(403); res.end("Forbidden"); return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end(`Not found: ${urlPath}`);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  });
});

const PORT = Number(process.env.PORT) || 8000;
server.listen(PORT, "127.0.0.1", () => {
  console.log(`FetchCPU-Pocho: http://127.0.0.1:${PORT}/`);
});
