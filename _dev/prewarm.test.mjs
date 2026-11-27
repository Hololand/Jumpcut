// Ready before the click (Phase 7 speed): the hints that warm the play
// page's connection, and the click time the homepage hands the frame. The
// rule from Phase 6 must hold: nothing starts before the visitor presses
// Play now.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as L from "../carousel-logic.js";
import { config } from "../config.js";

const PLAY = "https://play.jumpcut.cloud";
const read = (name) => readFile(fileURLToPath(new URL(`../${name}`, import.meta.url)), "utf8");

test("warmHints: a featured online tile showing its preview gets one preconnect to the play origin", () => {
  assert.deepEqual(L.warmHints("preview", "online", PLAY), [{ rel: "preconnect", href: PLAY }]);
});

test("warmHints: offline, busy, starting or playing gets no hint", () => {
  for (const state of ["offline", "busy", undefined]) assert.deepEqual(L.warmHints("preview", state, PLAY), [], String(state));
  for (const phase of ["launching", "playing"]) assert.deepEqual(L.warmHints(phase, "online", PLAY), [], phase);
});

test("warmHints: only an origin, never a path, so no hint can name a launch URL", () => {
  for (const bad of [`${PLAY}/`, `${PLAY}/?launchToken=x`, "play.jumpcut.cloud", "", null]) {
    assert.deepEqual(L.warmHints("preview", "online", bad), [], String(bad));
  }
});

test("warmHints: never a preload, prefetch or modulepreload (the play page sends no-store)", () => {
  const rels = L.warmHints("preview", "online", config.playOrigin).map((h) => h.rel);
  assert.deepEqual(rels, ["preconnect"]);
});

test("clickMessage carries the type and the time, and nothing else", () => {
  assert.deepEqual(L.clickMessage(1_800_000_000_000), { type: "cp-click", at: 1_800_000_000_000 });
});

// site.js has no test harness of its own (it needs a DOM), so these read its
// source: the launch call lives in play() alone, play() runs only from the
// Play now button, and the hints and the click message go nowhere else.
test("site.js: the launch call is made only inside play(), and play() only from Play now", async () => {
  const src = await read("site.js");
  const launches = [...src.matchAll(/\/v0\/demo\/launch/g)];
  assert.equal(launches.length, 1, "one launch call in the file");
  const playStart = src.indexOf("async function play()");
  const playEnd = src.indexOf("\nfunction startFrame(");
  assert.ok(playStart >= 0 && playEnd > playStart);
  const at = launches[0].index;
  assert.ok(at > playStart && at < playEnd, "the launch call is inside play()");
  // Every mention of the name play outside comments: its definition and the
  // Play now button.
  const code = src.replace(/\/\/[^\n]*/g, "");
  const mentions = [...code.matchAll(/(?<![\w."-])play\b(?![-\w])/g)].map((m) => code.slice(m.index - 24, m.index + 4));
  assert.equal(mentions.length, 2, mentions.join(" | "));
  assert.ok(mentions.some((m) => m.endsWith("function play")));
  assert.ok(mentions.some((m) => m.endsWith('button("Play now", play')));
});

test("site.js: the click time is taken first in play(), and posted to the play origin only", async () => {
  const src = await read("site.js");
  const body = src.slice(src.indexOf("async function play()"));
  assert.match(body, /^async function play\(\) \{\n(\s*\/\/[^\n]*\n)*\s*const clickedAt = Date\.now\(\);/);
  const posts = [...src.matchAll(/postMessage\((.*)\);/g)].map((m) => m[1]);
  assert.deepEqual(posts, ["L.clickMessage(clickedAt), config.playOrigin"]);
});

test("index.html: no hint to the play page is there before the status says online", async () => {
  const html = await read("index.html");
  assert.doesNotMatch(html, /<link[^>]*play\.jumpcut\.cloud/);
  assert.doesNotMatch(html, /rel="(preload|prefetch)"/);
});

test("site.js: hints come only from warmHints, so only for a featured online tile", async () => {
  const src = await read("site.js");
  assert.equal([...src.matchAll(/L\.warmHints\(/g)].length, 1);
  assert.match(src, /L\.warmHints\(s\.phase, s\.states\[tiles\[s\.index\]\.id\], config\.playOrigin\)/);
  assert.equal([...src.matchAll(/createElement\("link"\)/g)].length, 1, "no other link element is made");
});
