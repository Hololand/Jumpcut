// Connect before the click (Phase 7 speed): the featured tile connects to a
// waiting stream under its poster, and Play now only reveals it. It ships
// switched off (config.connectBeforeClick), and off it must change nothing.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as A from "../armed-logic.js";
import { config } from "../config.js";

const read = (name) => readFile(fileURLToPath(new URL(`../${name}`, import.meta.url)), "utf8");

// The page when a warm tile can arm.
const READY = Object.freeze({
  enabled: true, featured: "hello", state: "online", warm: true,
  phase: "preview", framed: false, hidden: false,
  now: 0, maxPerMinute: 2,
});

// A small stand-in for site.js: runs events through the machine, keeps the
// effects, and counts frames, so a test can say "never two".
function machine(view = READY) {
  const m = {
    arm: A.createArm(),
    view: { ...view },
    effects: [],
    armedFrames: 0,
    maxFrames: 0,
    send(event, change = {}) {
      Object.assign(m.view, change);
      const r = A.armStep(m.arm, event, m.view);
      m.arm = r.arm;
      for (const fx of r.effects) {
        if (fx === "frame") m.armedFrames += 1;
        if (fx === "removeFrame") m.armedFrames -= 1;
        if (fx === "reveal") {
          // The armed frame becomes the playing frame.
          m.armedFrames -= 1;
          m.view.framed = true;
          m.view.phase = "playing";
        }
      }
      const frames = m.armedFrames + (m.view.framed ? 1 : 0);
      m.maxFrames = Math.max(m.maxFrames, frames);
      assert.ok(m.armedFrames >= 0 && m.armedFrames <= 1, "armed frames stay 0 or 1");
      m.effects.push(...r.effects);
      return r.effects;
    },
    // sync, dwell, launched: the whole way to an armed frame.
    armUp() {
      assert.deepEqual(m.send({ type: "sync" }), ["startTimer"]);
      assert.deepEqual(m.send({ type: "dwell" }), ["launch"]);
      assert.deepEqual(m.send({ type: "launched", ok: true, url: "https://play.jumpcut.cloud/?launchToken=x#armed" }), ["frame"]);
      assert.equal(m.arm.stage, "armed");
    },
  };
  return m;
}

// ---------- the switch ----------

test("config: the switch ships off, with a whole-number dwell", () => {
  assert.equal(config.connectBeforeClick, false);
  assert.ok(Number.isInteger(config.armDwellMs) && config.armDwellMs > 0);
  assert.equal(config.armDwellMs, 1500);
});

test("switch off: no timer, no launch and no frame, whatever happens", () => {
  const m = machine({ ...READY, enabled: false });
  for (const event of [{ type: "sync" }, { type: "dwell" }, { type: "launched", ok: true, url: "u" }, { type: "ended" }, { type: "press" }]) {
    assert.deepEqual(m.send(event), [], event.type);
  }
  assert.equal(m.arm.stage, "idle");
});

test("site.js: with the switch off armEvent returns before anything else runs", async () => {
  const src = await read("site.js");
  assert.match(src, /function armEvent\(event\) \{\n\s*if \(config\.connectBeforeClick !== true\) return \[\];\n/);
  // Every timer, launch and frame of the arming goes through armEvent's effects.
  const code = src.replace(/\/\/[^\n]*/g, "");
  assert.equal([...code.matchAll(/\barmLaunch\(/g)].length, 2, "defined once, called once");
  assert.equal([...code.matchAll(/\barmFrame\(/g)].length, 2, "defined once, called once");
  assert.match(code, /fx === "launch"\) \{\n\s*armLaunch\(/);
  assert.match(code, /fx === "frame"\) \{\n\s*armFrame\(/);
  assert.equal([...code.matchAll(/config\.armDwellMs/g)].length, 1, "the dwell timer is the startTimer effect alone");
});

// ---------- when it arms ----------

test("arms a featured, online, warm tile only after the dwell", () => {
  const m = machine();
  assert.deepEqual(m.send({ type: "sync" }), ["startTimer"], "a timer, no launch yet");
  assert.deepEqual(m.send({ type: "sync" }), [], "a second sync starts no second timer");
  assert.deepEqual(m.send({ type: "dwell" }), ["launch"]);
  assert.deepEqual(m.send({ type: "launched", ok: true, url: "https://play.jumpcut.cloud/?launchToken=x#armed" }), ["frame"]);
});

test("does not arm when not warm, busy, offline, hidden, or while a stream starts or plays", () => {
  const cases = {
    "not warm": { warm: false },
    "warm absent": { warm: undefined },
    busy: { state: "busy" },
    offline: { state: "offline" },
    hidden: { hidden: true },
    launching: { phase: "launching" },
    playing: { phase: "playing", framed: true },
    "a frame already": { framed: true },
  };
  for (const [name, change] of Object.entries(cases)) {
    const m = machine({ ...READY, ...change });
    assert.deepEqual(m.send({ type: "sync" }), [], name);
    assert.deepEqual(m.send({ type: "dwell" }), [], `${name}: a stray dwell does nothing`);
    assert.equal(m.arm.stage, "idle", name);
  }
});

test("the dwell is cut short when the tile stops qualifying before it ends", () => {
  for (const change of [{ warm: false }, { state: "busy" }, { state: "offline" }, { hidden: true }]) {
    const m = machine();
    m.send({ type: "sync" });
    assert.deepEqual(m.send({ type: "sync" }, change), ["clearTimer"], JSON.stringify(change));
    assert.deepEqual(m.send({ type: "dwell" }), [], "the timer firing late launches nothing");
  }
});

test("a dwell cut short arms later in the same visit once the tile qualifies again", () => {
  const m = machine();
  m.send({ type: "sync" });
  m.send({ type: "sync" }, { warm: false });
  assert.deepEqual(m.send({ type: "sync" }, { warm: true }), ["startTimer"]);
});

// ---------- the press ----------

test("a press with an armed frame reveals it, with no second launch", () => {
  const m = machine();
  m.armUp();
  assert.deepEqual(m.send({ type: "press" }), ["reveal"]);
  assert.equal(m.effects.filter((fx) => fx === "launch").length, 1, "one launch in all");
  assert.equal(m.maxFrames, 1);
});

test("a press before the frame exists undoes the arming and leaves the press to today's flow", () => {
  const dwell = machine();
  dwell.send({ type: "sync" });
  assert.deepEqual(dwell.send({ type: "press" }), ["clearTimer"]);
  const launching = machine();
  launching.send({ type: "sync" });
  launching.send({ type: "dwell" });
  assert.deepEqual(launching.send({ type: "press" }), ["abortLaunch"]);
  assert.deepEqual(launching.send({ type: "launched", ok: true, url: "u" }), [], "a late answer makes no frame");
  const idle = machine({ ...READY, warm: false });
  assert.deepEqual(idle.send({ type: "press" }), []);
});

test("after a played stream ends the tile does not arm again in the same visit", () => {
  const m = machine();
  m.armUp();
  m.send({ type: "press" });
  // End demo: the frame goes and the tile shows its preview again.
  assert.deepEqual(m.send({ type: "sync" }, { phase: "preview", framed: false }), []);
});

// ---------- disarming ----------

test("disarm: another tile moves into the middle", () => {
  const m = machine();
  m.armUp();
  assert.deepEqual(m.send({ type: "sync" }, { featured: "airsim" }), ["removeFrame", "startTimer"],
    "the old frame goes; the new tile starts its own dwell");
  const d = machine();
  d.send({ type: "sync" });
  d.send({ type: "dwell" });
  assert.deepEqual(d.send({ type: "sync" }, { featured: "lyra", warm: false }), ["abortLaunch"]);
});

test("disarm: offline before the press removes the armed frame, with no re-arm in this visit", () => {
  const m = machine();
  m.armUp();
  assert.deepEqual(m.send({ type: "sync" }, { state: "offline" }), ["removeFrame"]);
  assert.deepEqual(m.send({ type: "sync" }, { state: "online" }), [], "no re-arm in this visit");
});

test("busy does not disarm an armed frame, which holds its own seat, and a press still reveals it", () => {
  const m = machine();
  m.armUp();
  assert.deepEqual(m.send({ type: "sync" }, { state: "busy", warm: false }), []);
  assert.equal(m.arm.stage, "armed");
  assert.deepEqual(m.send({ type: "press" }), ["reveal"]);
  assert.equal(m.effects.filter((fx) => fx === "launch").length, 1, "no second launch");
});

test("busy still stops a dwell or an arming launch call that has made no frame", () => {
  const d = machine();
  d.send({ type: "sync" });
  assert.deepEqual(d.send({ type: "sync" }, { state: "busy" }), ["clearTimer"]);
  const l = machine();
  l.send({ type: "sync" });
  l.send({ type: "dwell" });
  assert.deepEqual(l.send({ type: "sync" }, { state: "busy" }), ["abortLaunch"]);
});

test("shownState: busy over this visitor's armed tile shows online; everything else shows the status", () => {
  const m = machine();
  m.armUp();
  assert.equal(A.shownState(m.arm, "hello", "busy"), "online");
  assert.equal(A.shownState(m.arm, "hello", "offline"), "offline");
  assert.equal(A.shownState(m.arm, "airsim", "busy"), "busy", "another tile");
  const idle = A.createArm();
  for (const state of ["online", "busy", "offline"]) assert.equal(A.shownState(idle, "hello", state), state);
  const dwell = machine();
  dwell.send({ type: "sync" });
  assert.equal(A.shownState(dwell.arm, "hello", "busy"), "busy", "no frame yet");
});

test("site.js: the tile's label, action, consent and the press all read the shown state", async () => {
  const src = await read("site.js");
  assert.match(src, /function shownState\(id\) \{\n\s*return A\.shownState\(arm, id, s\.states\[id\]\);/);
  assert.match(src, /const state = shownState\(tile\.id\);/);
  assert.match(src, /s\.phase !== "preview" \|\| shownState\(tile\.id\) !== "online"\) return;/);
  assert.match(src, /L\.showsConsent\(s\.phase, shownState\(featured\.id\)\)/);
  assert.match(src, /function render\(\) \{\n(\s*\/\/[^\n]*\n)*\s*armEvent\(\{ type: "sync" \}\);/, "the arming syncs first");
  // armView reads the status itself, so busy reaches the rules.
  assert.match(src, /state: s\.states\[id\],/);
});

test("warm turning false does not tear down an armed frame, which holds the seat", () => {
  const m = machine();
  m.armUp();
  assert.deepEqual(m.send({ type: "sync" }, { warm: false }), []);
  assert.equal(m.arm.stage, "armed");
  assert.deepEqual(m.send({ type: "press" }), ["reveal"]);
});

test("disarm: not warm while the launch call is out aborts it", () => {
  const m = machine();
  m.send({ type: "sync" });
  m.send({ type: "dwell" });
  assert.deepEqual(m.send({ type: "sync" }, { warm: false }), ["abortLaunch"]);
  assert.deepEqual(m.send({ type: "sync" }, { warm: true }), [], "no re-arm in this visit");
});

test("disarm: the launch call fails or answers busy, and the tile does not try again", () => {
  const m = machine();
  m.send({ type: "sync" });
  m.send({ type: "dwell" });
  assert.deepEqual(m.send({ type: "launched", ok: false }), []);
  assert.equal(m.arm.stage, "idle");
  assert.deepEqual(m.send({ type: "sync" }), [], "no second dwell");
  assert.deepEqual(m.send({ type: "dwell" }), []);
});

test("disarm: the armed frame reports cp-ended, and no re-arm until the tile leaves and returns", () => {
  const m = machine();
  m.armUp();
  assert.deepEqual(m.send({ type: "ended" }), ["removeFrame"]);
  assert.deepEqual(m.send({ type: "sync" }), []);
  m.send({ type: "sync" }, { featured: "airsim", warm: false });
  assert.deepEqual(m.send({ type: "sync" }, { featured: "hello", warm: true }), ["startTimer"], "back in the middle: a fresh visit");
});

test("a reloaded page starts fresh", () => {
  const m = machine();
  m.armUp();
  m.send({ type: "ended" });
  const fresh = machine();
  assert.deepEqual(fresh.send({ type: "sync" }), ["startTimer"]);
});

test("the tab hidden disarms an armed frame and does not re-arm on return", () => {
  const m = machine();
  m.armUp();
  assert.deepEqual(m.send({ type: "sync" }, { hidden: true }), ["removeFrame"]);
  assert.deepEqual(m.send({ type: "sync" }, { hidden: false }), []);
  const d = machine();
  d.send({ type: "sync" });
  d.send({ type: "dwell" });
  assert.deepEqual(d.send({ type: "sync" }, { hidden: true }), ["abortLaunch"]);
});

test("an ended message with nothing armed changes nothing", () => {
  const m = machine();
  assert.deepEqual(m.send({ type: "ended" }), []);
});

test("never two frames, and never an armed one beside a playing stream, over many random paths", () => {
  // A fixed generator, so a failure is repeatable.
  let seed = 7;
  const rand = (n) => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const events = [
    () => [{ type: "sync" }, {}],
    () => [{ type: "dwell" }, {}],
    () => [{ type: "launched", ok: rand(3) > 0, url: "u" }, {}],
    () => [{ type: "ended" }, {}],
    () => [{ type: "press" }, {}],
    () => [{ type: "sync" }, { featured: ["lyra", "hello", "airsim"][rand(3)], phase: "preview", framed: false }],
    () => [{ type: "sync" }, { state: ["online", "busy", "offline"][rand(3)] }],
    () => [{ type: "sync" }, { warm: rand(2) === 0 }],
    () => [{ type: "sync" }, { hidden: rand(4) === 0 }],
  ];
  for (let run = 0; run < 200; run += 1) {
    const m = machine();
    for (let i = 0; i < 60; i += 1) {
      const [event, change] = events[rand(events.length)]();
      m.send(event, change);
      assert.ok(!(m.armedFrames > 0 && m.view.framed), "no armed frame beside a playing one");
    }
    assert.ok(m.maxFrames <= 1, `run ${run}`);
  }
});

// ---------- the cap on armings ----------

// Arm, then leave the middle and come back, at the given time.
function armAt(m, now, tile) {
  m.send({ type: "sync" }, { featured: tile, now });
  return m.send({ type: "dwell" }, { now });
}

test("config: armings are capped at 2 a minute, under the stack's launch limit of 6", () => {
  assert.equal(config.armMaxPerMinute, 2);
  assert.equal(A.ARM_WINDOW_MS, 60_000);
});

test("cap: the third arming inside a minute does not happen, and restarts no dwell in that visit", () => {
  const m = machine();
  assert.deepEqual(armAt(m, 0, "hello"), ["launch"]);
  assert.deepEqual(armAt(m, 2_000, "airsim"), ["launch"]);
  assert.deepEqual(armAt(m, 4_000, "hello"), [], "over the cap: no launch");
  assert.equal(m.arm.stage, "idle");
  assert.deepEqual(m.send({ type: "sync" }, { now: 59_000 }), [], "no new dwell in this visit");
  assert.equal(m.effects.filter((fx) => fx === "launch").length, 2);
});

test("cap: a later visit arms once the window has moved on", () => {
  const m = machine();
  armAt(m, 0, "hello");
  armAt(m, 2_000, "airsim");
  assert.deepEqual(armAt(m, 59_999, "hello"), [], "still inside the minute");
  assert.deepEqual(armAt(m, 60_000, "airsim"), ["launch"], "the first arming has left the window");
  assert.deepEqual(armAt(m, 61_000, "hello"), [], "the second is still inside it");
  assert.deepEqual(armAt(m, 62_000, "airsim"), ["launch"]);
});

test("cap: a press is never counted and never blocked, and with the cap reached it launches as today", () => {
  const m = machine();
  armAt(m, 0, "hello");
  armAt(m, 2_000, "airsim");
  armAt(m, 4_000, "hello");
  // No armed frame: the press undoes nothing and play() runs its own launch call.
  assert.deepEqual(m.send({ type: "press" }, { now: 5_000 }), []);
  assert.equal(m.arm.launches.length, 2, "the press is not counted");
  assert.equal(A.armRoom(m.arm, { ...m.view, now: 5_000 }), false);
});

test("cap: a missing or bad cap arms nothing", () => {
  for (const maxPerMinute of [undefined, 0, -1, 1.5, "2"]) {
    const m = machine({ ...READY, maxPerMinute });
    m.send({ type: "sync" });
    assert.deepEqual(m.send({ type: "dwell" }), [], String(maxPerMinute));
  }
});

test("site.js: the cap is read from config, and play() never consults it", async () => {
  const src = await read("site.js");
  assert.match(src, /maxPerMinute: config\.armMaxPerMinute,/);
  const play = src.slice(src.indexOf("async function play()"), src.indexOf("\nasync function launchCall("));
  assert.doesNotMatch(play, /armRoom|armMaxPerMinute|maxPerMinute/);
});

// ---------- the status flag and the messages ----------

test("readWarm: only a 200 with warm exactly true reads warm; an older stack's answer reads not warm", () => {
  const ids = ["lyra", "hello", "airsim"];
  const body = { games: [{ id: "hello", state: "online", warm: true }, { id: "lyra", state: "online", warm: "true" }, { id: "airsim", state: "online" }] };
  assert.deepEqual(A.readWarm(200, body, ids), { lyra: false, hello: true, airsim: false });
  assert.deepEqual(A.readWarm(500, body, ids), { lyra: false, hello: false, airsim: false });
  for (const bad of [null, {}, { games: "x" }, { games: [null, 3] }]) {
    assert.deepEqual(A.readWarm(200, bad, ids), { lyra: false, hello: false, airsim: false });
  }
});

test("armedUrl adds exactly #armed, replacing any fragment, and refuses a non-URL", () => {
  assert.equal(A.armedUrl("https://play.jumpcut.cloud/?launchToken=abc&lang=en"),
    "https://play.jumpcut.cloud/?launchToken=abc&lang=en#armed");
  assert.equal(A.armedUrl("https://play.jumpcut.cloud/?launchToken=abc#x"), "https://play.jumpcut.cloud/?launchToken=abc#armed");
  assert.equal(A.armedUrl("not a url"), null);
  assert.equal(A.armedUrl(undefined), null);
});

test("revealMessage carries the type and the time, and nothing else", () => {
  assert.deepEqual(A.revealMessage(1_800_000_000_000), { type: "cp-reveal", at: 1_800_000_000_000 });
});

// ---------- the wiring in site.js and site.css ----------

test("site.js: the armed frame sits under the preview, inert, out of the tab order and hidden from readers", async () => {
  const src = await read("site.js");
  const body = src.slice(src.indexOf("function armFrame("), src.indexOf("\nfunction removeArmedFrame("));
  assert.match(body, /classList\.add\("is-armed"\)/);
  assert.match(body, /frame\.inert = true;/);
  assert.match(body, /frame\.tabIndex = -1;/);
  assert.match(body, /setAttribute\("aria-hidden", "true"\)/);
  assert.match(body, /\.stage\.prepend\(frame\)/, "before the preview, so the poster paints over it");
  assert.doesNotMatch(body, /\.focus\(/);
});

test("site.js: the reveal lifts the frame in place, posts to the play origin and focuses it", async () => {
  const src = await read("site.js");
  const body = src.slice(src.indexOf("function revealArmed("));
  assert.match(body, /classList\.remove\("is-armed"\)/);
  assert.match(body, /classList\.add\("is-lifted"\)/);
  assert.match(body, /frame\.inert = false;/);
  assert.match(body, /s\.phase = "playing";/);
  assert.match(body, /frame\.focus\(\);/);
  assert.doesNotMatch(body.slice(0, body.indexOf("\n}\n")), /append\(|prepend\(|launchCall/, "no move, no launch");
  assert.match(src, /function postToFrame\(frame, message\) \{\n\s*if \(frame\.contentWindow\) frame\.contentWindow\.postMessage\(message, config\.playOrigin\);/);
});

test("site.js: Play now reveals an armed frame before anything of today's flow runs", async () => {
  const src = await read("site.js");
  const body = src.slice(src.indexOf("async function play()"));
  const reveal = body.indexOf('armEvent({ type: "press" })');
  assert.ok(reveal > 0 && reveal < body.indexOf('s.phase = "launching"'));
  assert.ok(body.indexOf("const clickedAt = Date.now();") < reveal, "the time is taken first");
});

test("site.js: an armed frame's cp-ended is quiet, and the tab hidden syncs the arming", async () => {
  const src = await read("site.js");
  assert.match(src, /if \(armed\.frame && e\.source === armed\.frame\.frame\.contentWindow\) \{\n\s*armEvent\(\{ type: "ended" \}\);\n\s*return;\n\s*\}/);
  const vis = src.slice(src.indexOf('document.addEventListener("visibilitychange"'));
  assert.match(vis.slice(0, vis.indexOf("} else {")), /armEvent\(\{ type: "sync" \}\)/);
});

// Every declaration block in the stylesheet whose selector names the class.
const rulesFor = (css, cls) => [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .filter((m) => m[1].includes(cls)).map((m) => m[2]);

test("site.css: the armed frame is invisible and takes no pointer, but stays laid out and rendering", async () => {
  const css = await read("site.css");
  const armed = rulesFor(css, ".is-armed");
  assert.equal(armed.length, 1);
  assert.match(armed[0], /(^|;)\s*opacity:\s*0\s*;/);
  assert.match(armed[0], /pointer-events:\s*none/);
  assert.doesNotMatch(armed[0], /\b(display|visibility)\s*:/, "never display or visibility: the stream must keep running");
});

test("site.css: the lifted frame sits over the preview at full opacity at once, with no transition to wait for", async () => {
  const css = await read("site.css");
  const lifted = rulesFor(css, ".is-lifted");
  assert.equal(lifted.length, 1);
  assert.match(lifted[0], /z-index:\s*1/);
  assert.match(lifted[0], /opacity:\s*1\s*;/);
  assert.match(lifted[0], /transition:\s*none/);
  // No rule that reaches the stage's frame animates it.
  for (const body of rulesFor(css, "iframe")) {
    assert.doesNotMatch(body, /transition:(?!\s*none\s*;)/, body);
  }
});

// ---------- the fake backend's warm flag ----------

test("fake backend: status sends no warm flag by default, and warm: true once set", async (t) => {
  const base = 20000 + Math.floor(Math.random() * 20000);
  const env = { ...process.env, DEV_SITE_PORT: String(base), DEV_FAKE_PORT: String(base + 1) };
  const child = spawn(process.execPath, [fileURLToPath(new URL("./serve.mjs", import.meta.url))], { env, stdio: ["ignore", "pipe", "pipe"] });
  t.after(() => child.kill());
  await new Promise((resolve, reject) => {
    let out = "";
    child.stdout.on("data", (c) => { out += c; if (out.includes("fake ")) resolve(); });
    child.on("exit", (code) => reject(new Error(`serve.mjs exited ${code}`)));
  });
  const fake = `http://127.0.0.1:${base + 1}`;
  const get = async (p) => (await fetch(fake + p)).json();
  await get("/_dev/state?all=online");
  let status = await get("/v0/demo/status");
  assert.deepEqual(status.games, [{ id: "hello", state: "online" }]);
  assert.deepEqual(A.readWarm(200, status, ["hello"]), { hello: false });
  await get("/_dev/state?warm=on");
  status = await get("/v0/demo/status");
  assert.deepEqual(status.games, [{ id: "hello", state: "online", warm: true }]);
  assert.deepEqual(A.readWarm(200, status, ["hello"]), { hello: true });
  await get("/_dev/state?warm=off");
  status = await get("/v0/demo/status");
  assert.equal("warm" in status.games[0], false);
});
