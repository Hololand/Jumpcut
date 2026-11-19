import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const read = (name) => readFile(fileURLToPath(new URL(name, root)), "utf8");

function csp(html) {
  const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]*)">/);
  assert.ok(m, "a CSP meta tag");
  return Object.fromEntries(m[1].split(";").map((d) => d.trim()).filter(Boolean)
    .map((d) => { const [k, ...v] = d.split(/\s+/); return [k, v]; }));
}

const DISCLAIMER = "To the fullest extent the law allows, Jumpcut and its licensors, including Epic Games, Inc. " +
  "and Microsoft Corporation, make no representations or warranties, accept no conditions and have no " +
  "liability of any kind in connection with the demos or the technology in them, including Unreal Engine.";
const UNREAL_TRADEMARK = "Unreal® is a trademark or registered trademark of Epic Games, Inc. in the United States of America and elsewhere.";
const UNREAL_COPYRIGHT = "Unreal® Engine, Copyright 1998 – 2026, Epic Games, Inc. All rights reserved.";

test("terms.html carries a CSP with no script source", async () => {
  const p = csp(await read("terms.html"));
  assert.deepEqual(p["default-src"], ["'none'"]);
  assert.equal(p["script-src"], undefined, "no script-src");
  assert.equal(p["connect-src"], undefined);
  assert.equal(p["frame-src"], undefined);
  assert.deepEqual(p["base-uri"], ["'none'"]);
  assert.deepEqual(p["form-action"], ["'none'"]);
});

test("terms.html has no script at all", async () => {
  assert.doesNotMatch(await read("terms.html"), /<script/i);
});

test("terms.html holds the disclaimer and both Unreal notices", async () => {
  const html = await read("terms.html");
  assert.ok(html.includes(DISCLAIMER), "the disclaimer sentence");
  assert.ok(html.includes(UNREAL_TRADEMARK), "the trademark notice");
  assert.ok(html.includes(UNREAL_COPYRIGHT), "the copyright notice");
  assert.ok(html.includes("Lyra Starter Game by Epic Games, Inc., used under the Fab Standard License."));
  assert.ok(html.includes("AirSim, Copyright (c) Microsoft Corporation"));
  assert.ok(html.includes('href="mailto:sales@jumpcut.cloud"'));
});

test("terms.html external links open safely and it links home", async () => {
  const html = await read("terms.html");
  const external = [...html.matchAll(/<a\s[^>]*href="https?:[^"]*"[^>]*>/g)].map((m) => m[0]);
  assert.ok(external.length >= 2, "the MIT and Godot links");
  for (const a of external) assert.match(a, /rel="noopener noreferrer"/, a);
  assert.match(html, /href="\.\/"/, "a link back to the homepage");
});

test("index.html links to the terms in the footer and beside Play now", async () => {
  const html = await read("index.html");
  const foot = html.slice(html.indexOf("<footer"), html.indexOf("</footer>"));
  assert.match(foot, /<a[^>]*href="terms\.html"[^>]*>Terms and credits<\/a>/);
  const top = html.slice(html.indexOf("<header"), html.indexOf("</header>"));
  // The upright-phone top bar has room for the short label only; its accessible name stays whole.
  assert.match(top, /<a class="top-terms" href="terms\.html" aria-label="Terms and credits">Terms<\/a>/);
  assert.match(html, /<p class="consent" id="consent">By playing you accept the <a href="terms\.html">demo terms<\/a>\.<\/p>/);
});

test("index.html CSP is unchanged by the terms", async () => {
  const p = csp(await read("index.html"));
  assert.deepEqual(p["script-src"], ["'self'"]);
  assert.deepEqual(p["connect-src"], ["https://rgs.jumpcut.cloud"]);
  assert.deepEqual(p["frame-src"], ["'self'", "https://play.jumpcut.cloud"]);
});
