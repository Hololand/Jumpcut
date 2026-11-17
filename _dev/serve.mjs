// Local preview of the homepage with a fake demo backend. No dependencies.
// Not published: Jekyll leaves folders that start with an underscore out.
//
//   node _dev/serve.mjs
//   site:  http://127.0.0.1:8600
//   fake:  http://127.0.0.1:8601  (status, launch and a fake play page)
//
// Env: DEV_SITE_PORT, DEV_FAKE_PORT, DEV_RGS_ORIGIN, DEV_PLAY_ORIGIN.
// The two origins default to the fake backend; point them at a real local
// stack to try the homepage against it.

import http from "node:http";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOST = "127.0.0.1";
const SITE_PORT = Number(process.env.DEV_SITE_PORT || 8600);
const FAKE_PORT = Number(process.env.DEV_FAKE_PORT || 8601);
const SITE_ORIGIN = `http://${HOST}:${SITE_PORT}`;
const FAKE_ORIGIN = `http://${HOST}:${FAKE_PORT}`;
const RGS_ORIGIN = process.env.DEV_RGS_ORIGIN || FAKE_ORIGIN;
const PLAY_ORIGIN = process.env.DEV_PLAY_ORIGIN || FAKE_ORIGIN;

const PROD_RGS = "https://rgs.jumpcut.cloud";
const PROD_PLAY = "https://play.jumpcut.cloud";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".json": "application/json",
};
const SWAPPED = new Set(["index.html", "config.js"]);

// ---------- the site ----------

const site = http.createServer(async (req, res) => {
  const url = new URL(req.url, SITE_ORIGIN);
  let rel = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  if (rel === "" || rel.endsWith("/")) rel += "index.html";
  const file = path.resolve(ROOT, rel);
  // Serve only what Pages would publish: nothing outside the repo, nothing hidden.
  const parts = path.relative(ROOT, file).split(path.sep);
  if (!file.startsWith(ROOT + path.sep) || parts.some((p) => p.startsWith("_") || p.startsWith("."))) {
    return send(res, 404, "text/plain", "Not found");
  }
  try {
    let body = await readFile(file);
    if (SWAPPED.has(rel)) {
      body = body.toString("utf8").split(PROD_RGS).join(RGS_ORIGIN).split(PROD_PLAY).join(PLAY_ORIGIN);
    }
    res.writeHead(200, {
      "content-type": TYPES[path.extname(file)] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    send(res, 404, "text/plain", "Not found");
  }
});

// ---------- the fake backend ----------

const KNOWN = ["hello"]; // the server knows only the slot so far
let states = {};
let launchMode = "ok"; // ok, rate_limited, error, wrong_origin
let exitReason = "idle"; // what the fake play page's button reports
let failStatus = false;
let log = {};
function reset() {
  states = Object.fromEntries(KNOWN.map((id) => [id, "offline"]));
  launchMode = "ok";
  exitReason = "idle";
  failStatus = false;
  log = { statusReads: 0, launches: 0, framesLoaded: 0, framesEnded: 0 };
}
reset();

function cors(req) {
  return req.headers.origin === SITE_ORIGIN
    ? { "access-control-allow-origin": SITE_ORIGIN, vary: "Origin" }
    : { vary: "Origin" };
}

function send(res, status, type, body, headers = {}) {
  res.writeHead(status, { "content-type": type, "cache-control": "no-store", ...headers });
  res.end(body);
}

function json(req, res, status, value) {
  send(res, status, "application/json", JSON.stringify(value), cors(req));
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 4096) req.destroy(); });
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(""));
  });
}

const STATES = new Set(["offline", "online", "busy"]);

const fake = http.createServer(async (req, res) => {
  const url = new URL(req.url, FAKE_ORIGIN);
  const p = url.pathname;

  if (req.method === "OPTIONS") {
    const h = cors(req);
    if (h["access-control-allow-origin"]) {
      h["access-control-allow-methods"] = "GET, POST";
      h["access-control-allow-headers"] = "content-type";
      h["access-control-max-age"] = "600";
    }
    res.writeHead(204, h);
    return res.end();
  }

  if (p === "/v0/demo/status" && req.method === "GET") {
    log.statusReads += 1;
    if (failStatus) return json(req, res, 500, { error: { code: "internal" } });
    return json(req, res, 200, { games: KNOWN.map((id) => ({ id, state: states[id] })) });
  }

  if (p === "/v0/demo/launch" && req.method === "POST") {
    let gameId;
    try { gameId = JSON.parse(await readBody(req)).gameId; } catch { gameId = undefined; }
    if (launchMode === "rate_limited") return json(req, res, 429, { error: { code: "rate_limited" } });
    if (launchMode === "error") return json(req, res, 500, { error: { code: "internal" } });
    const state = states[gameId] || "offline";
    if (state === "offline") return json(req, res, 503, { error: { code: "demos_offline" } });
    if (state === "busy") return json(req, res, 503, { error: { code: "demos_busy" } });
    log.launches += 1;
    const token = randomBytes(16).toString("base64url");
    const base = launchMode === "wrong_origin" ? `http://${HOST}:${FAKE_PORT + 1}` : FAKE_ORIGIN;
    return json(req, res, 200, { launchUrl: `${base}/?launchToken=${token}&lang=en` });
  }

  if (p === "/" && url.searchParams.has("launchToken")) {
    return send(res, 200, "text/html; charset=utf-8", playPage());
  }

  if (p === "/_dev/beacon" && req.method === "POST") {
    const e = url.searchParams.get("e");
    if (e === "loaded") log.framesLoaded += 1;
    if (e === "ended") log.framesEnded += 1;
    res.writeHead(204, cors(req));
    return res.end();
  }

  if (p === "/_dev/state") {
    const all = url.searchParams.get("all");
    if (all === "fail") failStatus = true;
    else if (STATES.has(all)) { failStatus = false; for (const id of KNOWN) states[id] = all; }
    for (const id of KNOWN) {
      const v = url.searchParams.get(id);
      if (STATES.has(v)) states[id] = v;
    }
    const launch = url.searchParams.get("launch");
    if (["ok", "rate_limited", "error", "wrong_origin"].includes(launch)) launchMode = launch;
    const exit = url.searchParams.get("exit");
    if (exit && /^[a-z_]{1,40}$/.test(exit)) exitReason = exit;
    return json(req, res, 200, { states, failStatus, launchMode, exitReason });
  }

  if (p === "/_dev/log") return json(req, res, 200, log);
  if (p === "/_dev/reset") { reset(); return json(req, res, 200, log); }

  send(res, 404, "text/plain", "Not found");
});

// The fake play page: fills its frame, counts the input it receives, and
// reports loading and unloading to the fake backend.
function playPage() {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Fake play page</title>
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; touch-action: none; }
  body { display: grid; place-items: center; background: #183a40; color: #f3e7d3;
    font: 600 16px/1.2 system-ui, sans-serif; user-select: none; }
  .wrap { text-align: center; }
  .n { display: grid; grid-template-columns: repeat(3, auto); gap: 6px 28px; margin: 14px 0 18px; }
  .n b { font-size: clamp(28px, 8vmin, 72px); font-variant-numeric: tabular-nums; }
  .n span { font-size: 12px; letter-spacing: .12em; text-transform: uppercase; opacity: .75; }
  button { font: inherit; padding: 10px 18px; border-radius: 999px; border: 0; background: #f3e7d3; color: #0e2228; cursor: pointer; }
</style></head>
<body><div class="wrap">
  <div>FAKE PLAY PAGE</div>
  <div class="n">
    <b id="w">0</b><b id="t">0</b><b id="p">0</b>
    <span>wheel</span><span>touch</span><span>pointer</span>
  </div>
  <button id="end" type="button">End with ${exitReason}</button>
</div>
<script>
  const c = { w: 0, t: 0, p: 0 };
  const bump = (k) => { c[k] += 1; document.getElementById(k).textContent = c[k]; };
  addEventListener("wheel", (e) => { e.preventDefault(); bump("w"); }, { passive: false });
  addEventListener("touchstart", () => bump("t"), { passive: true });
  addEventListener("touchmove", () => bump("t"), { passive: true });
  addEventListener("pointerdown", () => bump("p"));
  addEventListener("pointermove", () => bump("p"));
  navigator.sendBeacon("${FAKE_ORIGIN}/_dev/beacon?e=loaded");
  addEventListener("pagehide", () => navigator.sendBeacon("${FAKE_ORIGIN}/_dev/beacon?e=ended"));
  document.getElementById("end").addEventListener("click", () => {
    location.href = "${SITE_ORIGIN}/ended.html?cpExit=${exitReason}";
  });
</script></body></html>`;
}

site.listen(SITE_PORT, HOST, () => console.log(`site  ${SITE_ORIGIN}  (rgs ${RGS_ORIGIN}, play ${PLAY_ORIGIN})`));
fake.listen(FAKE_PORT, HOST, () => console.log(`fake  ${FAKE_ORIGIN}  (/_dev/state, /_dev/log, /_dev/reset)`));
