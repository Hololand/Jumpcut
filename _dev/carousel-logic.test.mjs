import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as L from "../carousel-logic.js";
import { config } from "../config.js";
import { icons } from "../icons.js";

const PLAY = "https://play.jumpcut.cloud";

test("clampIndex keeps the index inside the list", () => {
  assert.equal(L.clampIndex(1, 3), 1);
  assert.equal(L.clampIndex(-1, 3), 0);
  assert.equal(L.clampIndex(3, 3), 2);
  assert.equal(L.clampIndex(99, 3), 2);
  assert.equal(L.clampIndex(1.7, 3), 1);
  assert.equal(L.clampIndex(NaN, 3), 0);
  assert.equal(L.clampIndex(2, 0), 0);
});

test("stepIndex moves one tile and stops at both ends", () => {
  assert.equal(L.stepIndex(1, 1, 3), 2);
  assert.equal(L.stepIndex(1, -1, 3), 0);
  assert.equal(L.stepIndex(1, 40, 3), 2, "a big step is still one step");
  assert.equal(L.stepIndex(1, -40, 3), 0);
  assert.equal(L.stepIndex(2, 1, 3), 2, "no step past the last tile");
  assert.equal(L.stepIndex(0, -1, 3), 0, "no step before the first tile");
  assert.equal(L.stepIndex(1, 0, 3), 1);
});

test("tileState reads a game's state and fails closed", () => {
  const body = { games: [{ id: "hello", state: "online" }, { id: "x", state: "busy" }] };
  assert.equal(L.tileState(body, "hello"), "online");
  assert.equal(L.tileState(body, "x"), "busy");
  assert.equal(L.tileState(body, "lyra"), "offline", "a missing game is offline");
  assert.equal(L.tileState({ games: [{ id: "hello", state: "ready" }] }, "hello"), "offline");
  assert.equal(L.tileState({ games: [{ id: "hello" }] }, "hello"), "offline");
  assert.equal(L.tileState({ games: [null, 3, "hello"] }, "hello"), "offline");
  assert.equal(L.tileState({ games: "hello" }, "hello"), "offline");
  assert.equal(L.tileState({}, "hello"), "offline");
  assert.equal(L.tileState(null, "hello"), "offline");
  assert.equal(L.tileState("online", "hello"), "offline");
});

test("readStatus maps every tile and treats non-200 as offline", () => {
  const ids = ["lyra", "hello", "airsim"];
  const body = { games: [{ id: "hello", state: "online" }] };
  assert.deepEqual(L.readStatus(200, body, ids), { lyra: "offline", hello: "online", airsim: "offline" });
  assert.deepEqual(L.readStatus(500, body, ids), { lyra: "offline", hello: "offline", airsim: "offline" });
  assert.deepEqual(L.readStatus(0, null, ids), { lyra: "offline", hello: "offline", airsim: "offline" });
  assert.deepEqual(L.readStatus(200, "<html>", ids), { lyra: "offline", hello: "offline", airsim: "offline" });
});

test("checkLaunchUrl accepts only the exact play origin", () => {
  const good = `${PLAY}/?launchToken=abc&lang=en`;
  assert.equal(L.checkLaunchUrl(good, PLAY), good);
  assert.equal(L.checkLaunchUrl("https://evil.example/?launchToken=abc", PLAY), null);
  assert.equal(L.checkLaunchUrl("https://play.jumpcut.cloud.evil.example/", PLAY), null);
  assert.equal(L.checkLaunchUrl("http://play.jumpcut.cloud/?launchToken=abc", PLAY), null, "wrong scheme");
  assert.equal(L.checkLaunchUrl("https://play.jumpcut.cloud:8443/", PLAY), null, "wrong port");
  assert.equal(L.checkLaunchUrl("https://user:pw@play.jumpcut.cloud/", PLAY), null);
  assert.equal(L.checkLaunchUrl("javascript:alert(1)", PLAY), null);
  assert.equal(L.checkLaunchUrl("/?launchToken=abc", PLAY), null, "relative URLs are refused");
  assert.equal(L.checkLaunchUrl(undefined, PLAY), null);
  assert.equal(L.checkLaunchUrl(42, PLAY), null);
  assert.equal(L.checkLaunchUrl("http://127.0.0.1:8601/?launchToken=a", "http://127.0.0.1:8601"),
    "http://127.0.0.1:8601/?launchToken=a");
});

test("launchOutcome maps every answer", () => {
  const url = `${PLAY}/?launchToken=abc`;
  assert.deepEqual(L.launchOutcome(200, { launchUrl: url }, PLAY), { kind: "play", url });
  assert.deepEqual(L.launchOutcome(200, { launchUrl: "https://elsewhere.example/" }, PLAY), { kind: "failed" });
  assert.deepEqual(L.launchOutcome(200, null, PLAY), { kind: "failed" });
  assert.deepEqual(L.launchOutcome(503, { error: { code: "demos_offline" } }, PLAY), { kind: "offline" });
  assert.deepEqual(L.launchOutcome(503, { error: { code: "demos_busy" } }, PLAY), { kind: "busy" });
  assert.deepEqual(L.launchOutcome(503, { error: { code: "other" } }, PLAY), { kind: "failed" });
  assert.deepEqual(L.launchOutcome(503, null, PLAY), { kind: "failed" });
  assert.deepEqual(L.launchOutcome(429, { error: { code: "rate_limited" } }, PLAY), { kind: "rate_limited" });
  assert.deepEqual(L.launchOutcome(500, { error: { code: "x" } }, PLAY), { kind: "failed" });
  assert.deepEqual(L.launchOutcome(0, null, PLAY), { kind: "failed" }, "a network failure");
});

test("showsConsent goes with Play now only", () => {
  assert.equal(L.showsConsent("preview", "online"), true);
  assert.equal(L.showsConsent("preview", "offline"), false);
  assert.equal(L.showsConsent("preview", "busy"), false);
  assert.equal(L.showsConsent("launching", "online"), false);
  assert.equal(L.showsConsent("playing", "online"), false, "never over a stream");
  assert.equal(L.showsConsent(undefined, undefined), false);
});

test("endReason passes known reasons and folds the rest", () => {
  for (const r of L.END_REASONS) assert.equal(L.endReason(r), r);
  assert.equal(L.endReason("hacked"), "stream_ended");
  assert.equal(L.endReason(""), "stream_ended");
  assert.equal(L.endReason(null), "stream_ended");
  assert.equal(L.endReason("IDLE"), "stream_ended");
});

test("wheelPixels normalises delta modes", () => {
  assert.equal(L.wheelPixels(10, 0, 900), 10);
  assert.equal(L.wheelPixels(3, 1, 900), 48);
  assert.equal(L.wheelPixels(1, 2, 900), 900);
  assert.equal(L.wheelPixels(NaN, 0, 900), 0);
});

function runWheel(events, opts) {
  let state = L.createWheelState();
  const steps = [];
  for (const e of events) {
    const r = L.wheelStep(state, e, opts);
    state = r.state;
    if (r.step) steps.push(r.step);
  }
  return steps;
}

test("wheelStep gives one step per gesture however hard it is flung", () => {
  const fling = Array.from({ length: 80 }, (_, i) => ({ deltaY: 200 - i * 2, time: i * 16 }));
  assert.deepEqual(runWheel(fling), [1]);
  const up = Array.from({ length: 40 }, (_, i) => ({ deltaY: -120, time: i * 16 }));
  assert.deepEqual(runWheel(up), [-1]);
});

test("wheelStep adds small deltas up to the threshold", () => {
  assert.deepEqual(runWheel([{ deltaY: 5, time: 0 }, { deltaY: 5, time: 16 }]), []);
  assert.deepEqual(runWheel([5, 5, 5, 5, 5].map((d, i) => ({ deltaY: d, time: i * 16 }))), [1]);
});

test("wheelStep allows a new gesture after a quiet gap", () => {
  const events = [
    { deltaY: 100, time: 0 },
    { deltaY: 100, time: 50 },
    { deltaY: 100, time: 400 },
    { deltaY: -100, time: 800 },
  ];
  assert.deepEqual(runWheel(events), [1, 1, -1]);
});

test("wheelStep resets the sum when direction flips", () => {
  const events = [{ deltaY: 20, time: 0 }, { deltaY: -20, time: 16 }, { deltaY: 20, time: 32 }];
  assert.deepEqual(runWheel(events), []);
});

test("swipeStep gives one step per vertical swipe", () => {
  assert.equal(L.swipeStep(0, -120), 1, "finger up brings the next tile");
  assert.equal(L.swipeStep(0, 120), -1);
  assert.equal(L.swipeStep(0, -900), 1, "a hard fling is still one step");
  assert.equal(L.swipeStep(0, 20), 0, "too short");
  assert.equal(L.swipeStep(200, -100), 0, "mostly sideways");
  assert.equal(L.swipeStep(NaN, 100), 0);
});

test("keyStep maps the four keys", () => {
  assert.equal(L.keyStep("ArrowDown"), 1);
  assert.equal(L.keyStep("PageDown"), 1);
  assert.equal(L.keyStep("ArrowUp"), -1);
  assert.equal(L.keyStep("PageUp"), -1);
  assert.equal(L.keyStep("Enter"), 0);
  assert.equal(L.keyStep(" "), 0);
});

test("slotOffset parks far tiles at plus or minus two", () => {
  assert.equal(L.slotOffset(1, 1), 0);
  assert.equal(L.slotOffset(0, 1), -1);
  assert.equal(L.slotOffset(2, 1), 1);
  assert.equal(L.slotOffset(5, 0), 2);
  assert.equal(L.slotOffset(0, 5), -2);
});

test("positionLabel pads both numbers", () => {
  assert.equal(L.positionLabel(1, 3), "02 / 03");
  assert.equal(L.positionLabel(0, 3), "01 / 03");
  assert.equal(L.positionLabel(9, 3), "03 / 03");
});

test("fitTile fits 16:9 in landscape", () => {
  const t = L.fitTile({ width: 800, height: 600 }, "landscape", { gap: 20, peek: 70, scale: 0.8 });
  assert.equal(t.height, 420);
  assert.equal(t.width, 747);
  assert.equal(t.shift, Math.round(210 + 20 + 168));
  const wide = L.fitTile({ width: 400, height: 2000 }, "landscape", { gap: 20, peek: 70 });
  assert.equal(wide.width, 400);
  assert.equal(wide.height, 225);
});

test("fitTile takes the full width in portrait and caps at 9:16", () => {
  const t = L.fitTile({ width: 358, height: 600 }, "portrait", { gap: 10, peek: 40 });
  assert.equal(t.width, 358);
  assert.equal(t.height, 500);
  const tall = L.fitTile({ width: 300, height: 2000 }, "portrait", { gap: 10, peek: 40 });
  assert.equal(tall.height, Math.round((300 * 16) / 9));
  const squat = L.fitTile({ width: 800, height: 300 }, "portrait", { gap: 10, peek: 40 });
  assert.equal(squat.height, 200, "too short for portrait falls back to 16:9");
  assert.equal(squat.width, 356);
});

test("fitTile never goes negative", () => {
  const t = L.fitTile({ width: 0, height: 10 }, "landscape");
  assert.equal(t.width, 0);
  assert.equal(t.height, 0);
});

test("config lists Video Games, iGaming and Simulations in order and features iGaming", () => {
  assert.deepEqual(config.tiles.map((t) => t.name), ["Video Games", "iGaming", "Simulations"]);
  assert.deepEqual(config.tiles.map((t) => t.id), ["lyra", "hello", "airsim"]);
  assert.equal(config.featuredOnLoad, "hello");
  assert.equal(config.rgsOrigin, "https://rgs.jumpcut.cloud");
  assert.equal(config.playOrigin, "https://play.jumpcut.cloud");
  for (const t of config.tiles) assert.ok(t.media.still, `${t.name} has a still`);
});

test("every tile has exactly three points, each with text and a known icon", () => {
  for (const tile of config.tiles) {
    assert.equal(tile.points.length, 3, tile.id);
    for (const p of tile.points) {
      assert.ok(p && typeof p === "object", `${tile.id}: a point is an object`);
      assert.ok(typeof p.text === "string" && p.text.trim().length > 0, `${tile.id}: non-empty text`);
      assert.ok(typeof p.icon === "string" && Object.hasOwn(icons, p.icon), `${tile.id}: icon ${p.icon} is in icons.js`);
    }
  }
});

test("the points keep their wording", () => {
  assert.deepEqual(config.tiles.map((t) => t.points.map((p) => p.text)), [
    ["Play before the download finishes", "Drives player acquisition", "Safe from decompilation"],
    ["Industry-leading quality", "Instant time to fun", "Tamper-proof by design"],
    ["Secure: nothing runs on the device", "Anywhere with an internet connection", "Any device, no special hardware"],
  ]);
});

test("index.html's first paint shows the featured scene", async () => {
  const html = await readFile(fileURLToPath(new URL("../index.html", import.meta.url)), "utf8");
  const featured = config.tiles.find((t) => t.id === config.featuredOnLoad);
  assert.match(html, new RegExp(`<body data-scene="${featured.id}">`));
  const list = html.slice(html.indexOf('<ul class="points"'), html.indexOf("</ul>"));
  const rows = [...list.matchAll(/<li><span class="point-icon"><\/span><span>([^<]*)<\/span><\/li>/g)].map((m) => m[1]);
  assert.deepEqual(rows, featured.points.map((p) => p.text));
  const layers = html.slice(html.indexOf('<div class="backdrops" aria-hidden="true">'), html.indexOf('<div class="page">'));
  for (const t of config.tiles) assert.match(layers, new RegExp(`class="backdrop backdrop-${t.id}"`), t.id);
});

test("every icon is a list of path strings", () => {
  for (const [key, paths] of Object.entries(icons)) {
    assert.ok(Array.isArray(paths) && paths.length > 0, key);
    for (const d of paths) assert.ok(typeof d === "string" && /^M/.test(d), `${key}: ${d}`);
  }
});
