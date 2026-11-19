// The homepage: builds the carousel from config.js, follows the demo status,
// and runs one visitor's stream inside the featured tile. The rules live in
// carousel-logic.js; this file only wires them to the page.

import { config } from "./config.js";
import * as L from "./carousel-logic.js";

const tiles = config.tiles;
const ids = tiles.map((t) => t.id);
const $ = (id) => document.getElementById(id);

const el = {
  carousel: $("carousel"),
  track: $("track"),
  position: $("position"),
  state: $("state"),
  name: $("name"),
  pitch: $("pitch"),
  action: $("action"),
  note: $("note"),
  consent: $("consent"),
  announce: $("announce"),
};

const portraitQuery = matchMedia("(max-aspect-ratio: 1/1) and (max-width: 48rem)");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

const STATE_TEXT = {
  online: "Live now",
  busy: "All seats in use",
  offline: "Demo on request",
  playing: "Playing",
  launching: "Starting",
};

const NOTES = {
  rate_limited: "Too many tries. Wait a minute.",
  failed: "The demo could not start. Try again in a minute.",
  offline: "The demos have just gone offline.",
  no_capacity: "No demo seat was free. Try again in a minute.",
  error: "The demo stopped because of an error. Try again in a minute.",
};

const s = {
  index: L.clampIndex(Math.max(0, ids.indexOf(config.featuredOnLoad)), tiles.length),
  states: L.readStatus(0, null, ids),
  phase: "preview", // preview, launching or playing
  note: "",
  mode: portraitQuery.matches ? "portrait" : "landscape",
  wheel: L.createWheelState(),
  touch: null,
  launchCtl: null,
  frame: null,
  pollTimer: 0,
  pollCtl: null,
  announced: "",
};

// Build the tiles once. Each keeps its still underneath, so a missing poster
// or video simply leaves the still showing.
const tileEls = tiles.map((tile, i) => {
  const root = document.createElement("div");
  root.className = "tile";
  root.setAttribute("role", "group");
  root.setAttribute("aria-roledescription", "slide");
  root.setAttribute("aria-label", `${tile.name}, ${i + 1} of ${tiles.length}`);

  const stage = document.createElement("div");
  stage.className = "stage";
  const preview = document.createElement("div");
  preview.className = "preview";
  const still = document.createElement("img");
  still.className = "still";
  still.alt = "";
  still.decoding = "async";
  still.src = tile.media.still;
  preview.append(still);
  stage.append(preview);

  const label = document.createElement("span");
  label.className = "tile-label";
  label.setAttribute("aria-hidden", "true");
  const name = document.createElement("span");
  name.className = "tile-name";
  name.textContent = tile.name;
  const state = document.createElement("span");
  state.className = "tile-state";
  label.append(name, state);

  const pick = document.createElement("button");
  pick.type = "button";
  pick.className = "tile-pick";
  pick.setAttribute("aria-label", `Show the ${tile.name} demo`);
  pick.addEventListener("click", () => moveTo(i));

  root.append(stage, label, pick);
  el.track.append(root);
  return { root, stage, preview, state, pick, poster: null, video: null };
});

// ---------- rendering ----------

function render() {
  const featured = tiles[s.index];
  tileEls.forEach((t, i) => {
    const offset = L.slotOffset(i, s.index);
    t.root.dataset.offset = String(offset);
    const far = Math.abs(offset) > 1;
    t.root.inert = far;
    t.root.setAttribute("aria-hidden", far ? "true" : "false");
    t.pick.hidden = offset === 0;
    t.state.textContent = STATE_TEXT[s.states[tiles[i].id]];
  });

  const shown = s.phase === "preview" ? s.states[featured.id] : s.phase;
  el.position.textContent = L.positionLabel(s.index, tiles.length);
  el.state.dataset.state = shown === "launching" ? "playing" : shown;
  el.state.textContent = STATE_TEXT[shown];
  el.name.textContent = featured.name;
  el.pitch.textContent = featured.pitch;
  el.note.textContent = s.note;
  renderAction(featured);
  // The terms line goes with Play now and nothing else, so never with a stream.
  el.consent.classList.toggle("is-on", L.showsConsent(s.phase, s.states[featured.id]));
  renderMedia();

  const line = `${featured.name}, ${s.index + 1} of ${tiles.length}. ${STATE_TEXT[shown]}.`;
  if (line !== s.announced) {
    s.announced = line;
    el.announce.textContent = line;
  }
}

function renderAction(tile) {
  const hadFocus = el.action.contains(document.activeElement);
  const state = s.states[tile.id];
  const nodes = [];
  if (s.phase === "playing") {
    nodes.push(button("End demo", endDemo, "button button-quiet", ICON_STOP));
  } else if (s.phase === "launching") {
    const b = button("Starting", null, "button", ICON_PLAY);
    b.disabled = true;
    nodes.push(b);
  } else if (state === "online") {
    nodes.push(button("Play now", play, "button", ICON_PLAY));
  } else if (state === "busy") {
    const p = document.createElement("p");
    p.className = "busy-line";
    p.textContent = "Every demo seat is taken. Try again in a few minutes, or ";
    const a = mailLink("request a demo", "text-link");
    p.append(a, ".");
    nodes.push(p);
  } else {
    nodes.push(mailLink("Request a demo", "button button-quiet"));
  }
  const key = nodes.map((n) => n.textContent + (n.disabled ? "!" : "")).join("|");
  if (el.action.dataset.key === key) return;
  el.action.dataset.key = key;
  el.action.replaceChildren(...nodes);
  if (hadFocus) {
    const target = el.action.querySelector("button:not([disabled]), a");
    if (target) target.focus();
  }
}

const ICON_PLAY = "M2 1 L14 8 L2 15 Z";
const ICON_STOP = "M2 2 H14 V14 H2 Z";

function button(text, onClick, className, iconPath) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = className;
  if (iconPath) b.append(icon(iconPath));
  b.append(text);
  if (onClick) b.addEventListener("click", onClick);
  return b;
}

function icon(path) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", path);
  p.setAttribute("fill", "currentColor");
  svg.append(p);
  return svg;
}

function mailLink(text, className) {
  const a = document.createElement("a");
  a.className = className;
  a.href = `mailto:${config.salesEmail}`;
  a.textContent = text;
  return a;
}

// Posters on every tile; a looping video only on the featured one, and only
// while it shows its preview. A file that failed once is not asked for again.
const missing = new Set();

function renderMedia() {
  tileEls.forEach((t, i) => {
    const media = tiles[i].media[s.mode];
    const posterSrc = media && media.poster && !missing.has(media.poster) ? media.poster : null;
    if (posterSrc && (!t.poster || t.poster.dataset.src !== posterSrc)) {
      if (t.poster) t.poster.remove();
      const img = document.createElement("img");
      img.className = "poster";
      img.alt = "";
      img.decoding = "async";
      img.dataset.src = posterSrc;
      img.addEventListener("load", () => img.classList.add("is-on"));
      img.addEventListener("error", () => {
        missing.add(posterSrc);
        img.remove();
        if (t.poster === img) t.poster = null;
      });
      img.src = posterSrc;
      t.preview.append(img);
      t.poster = img;
    } else if (!posterSrc && t.poster) {
      t.poster.remove();
      t.poster = null;
    }

    const want = i === s.index && s.phase === "preview" && !reducedMotion.matches &&
      media && media.video && !missing.has(media.video);
    if (!want) {
      if (t.video) {
        t.video.pause();
        t.video.removeAttribute("src");
        t.video.load();
        t.video.remove();
        t.video = null;
      }
      return;
    }
    if (t.video && t.video.dataset.src === media.video) return;
    if (t.video) t.video.remove();
    const v = document.createElement("video");
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    v.playsInline = true;
    v.autoplay = true;
    v.preload = "auto";
    v.setAttribute("muted", "");
    v.setAttribute("playsinline", "");
    v.setAttribute("aria-hidden", "true");
    v.dataset.src = media.video;
    v.addEventListener("playing", () => v.classList.add("is-on"));
    v.addEventListener("error", () => {
      if (t.video !== v) return; // already taken down on purpose
      missing.add(media.video);
      v.remove();
      t.video = null;
    });
    v.src = media.video;
    t.preview.append(v);
    t.video = v;
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  });
}

function layout() {
  s.mode = portraitQuery.matches ? "portrait" : "landscape";
  const css = getComputedStyle(el.carousel);
  const box = el.carousel.getBoundingClientRect();
  const fit = L.fitTile({ width: box.width, height: box.height }, s.mode, {
    gap: parseFloat(css.getPropertyValue("--gap")) || 16,
    peek: parseFloat(css.getPropertyValue("--peek")) || 56,
    scale: parseFloat(css.getPropertyValue("--scale")) || 0.84,
  });
  el.carousel.style.setProperty("--tile-w", `${fit.width}px`);
  el.carousel.style.setProperty("--tile-h", `${fit.height}px`);
  el.carousel.style.setProperty("--shift", `${fit.shift}px`);
  renderMedia();
}

// ---------- moving ----------

function moveTo(index) {
  const next = L.clampIndex(index, tiles.length);
  if (next === s.index) return;
  if (s.phase !== "preview") stopStream();
  s.index = next;
  s.note = "";
  render();
}

function move(step) {
  moveTo(L.stepIndex(s.index, step, tiles.length));
}

function playingOn(target) {
  return s.phase === "playing" && target instanceof Node && tileEls[s.index].root.contains(target);
}

addEventListener("wheel", (e) => {
  if (e.ctrlKey) return; // pinch zoom on a trackpad
  e.preventDefault();
  if (playingOn(e.target)) return;
  const vertical = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : 0;
  const r = L.wheelStep(s.wheel, {
    deltaY: L.wheelPixels(vertical, e.deltaMode, innerHeight),
    time: e.timeStamp,
  });
  s.wheel = r.state;
  if (r.step) move(r.step);
}, { passive: false });

addEventListener("touchstart", (e) => {
  if (e.touches.length !== 1) { s.touch = null; return; }
  const t = e.touches[0];
  s.touch = { x: t.clientX, y: t.clientY, ignore: playingOn(e.target) };
}, { passive: true });

addEventListener("touchmove", (e) => {
  // Stops the page from rubber-banding; pinch zoom still works.
  if (s.touch && e.touches.length === 1 && e.cancelable) e.preventDefault();
}, { passive: false });

addEventListener("touchend", (e) => {
  const start = s.touch;
  s.touch = null;
  if (!start || start.ignore || e.changedTouches.length !== 1) return;
  const t = e.changedTouches[0];
  const step = L.swipeStep(t.clientX - start.x, t.clientY - start.y);
  if (step) move(step);
});

addEventListener("touchcancel", () => { s.touch = null; });

addEventListener("keydown", (e) => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
  const step = L.keyStep(e.key);
  if (!step) return;
  e.preventDefault();
  move(step);
});

// ---------- the stream ----------

async function play() {
  const tile = tiles[s.index];
  if (s.phase !== "preview" || s.states[tile.id] !== "online") return;
  s.phase = "launching";
  s.note = "";
  render();

  const ctl = new AbortController();
  s.launchCtl = ctl;
  const timer = setTimeout(() => ctl.abort(), config.launchTimeoutMs);
  let status = 0;
  let body = null;
  try {
    const res = await fetch(`${config.rgsOrigin}/v0/demo/launch`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gameId: tile.id }),
      credentials: "omit",
      cache: "no-store",
      signal: ctl.signal,
    });
    status = res.status;
    body = await res.json().catch(() => null);
  } catch {
    // A network failure or a time-out: status stays 0.
  } finally {
    clearTimeout(timer);
  }
  if (s.launchCtl !== ctl) return; // the visitor moved on meanwhile
  s.launchCtl = null;

  const out = L.launchOutcome(status, body, config.playOrigin);
  if (out.kind === "play") {
    startFrame(out.url, tile);
    return;
  }
  s.phase = "preview";
  if (out.kind === "offline") s.states[tile.id] = "offline";
  if (out.kind === "busy") s.states[tile.id] = "busy";
  s.note = NOTES[out.kind] || "";
  render();
}

function startFrame(url, tile) {
  removeFrame();
  const frame = document.createElement("iframe");
  frame.title = `${tile.name} demo, live stream`;
  frame.allow = "autoplay; fullscreen; gamepad";
  frame.src = url;
  s.frame = frame;
  s.phase = "playing";
  tileEls[s.index].stage.append(frame);
  render();
  frame.focus();
}

function removeFrame() {
  // Removing the frame unloads the play page, and the play page ends its own stream.
  if (s.frame) {
    s.frame.remove();
    s.frame = null;
  }
}

function stopStream() {
  if (s.launchCtl) {
    const ctl = s.launchCtl;
    s.launchCtl = null;
    ctl.abort();
  }
  removeFrame();
  s.phase = "preview";
}

function endDemo() {
  stopStream();
  s.note = "";
  render();
  poll();
}

// ended.html, inside the frame, reports a stream that ended on its own.
addEventListener("message", (e) => {
  if (e.origin !== location.origin) return;
  if (!s.frame || e.source !== s.frame.contentWindow) return;
  const data = e.data;
  if (!data || typeof data !== "object" || data.type !== "cp-ended") return;
  const reason = L.endReason(data.reason);
  stopStream();
  s.note = NOTES[reason] && (reason === "no_capacity" || reason === "error") ? NOTES[reason] : "";
  render();
  poll();
});

// ---------- status ----------

async function poll() {
  clearTimeout(s.pollTimer);
  s.pollTimer = 0;
  if (s.pollCtl) s.pollCtl.abort();
  s.pollCtl = null;
  if (document.hidden) return;

  const ctl = new AbortController();
  s.pollCtl = ctl;
  const timer = setTimeout(() => ctl.abort(), config.statusTimeoutMs);
  let status = 0;
  let body = null;
  try {
    const res = await fetch(`${config.rgsOrigin}/v0/demo/status`, {
      credentials: "omit",
      cache: "no-store",
      signal: ctl.signal,
    });
    status = res.status;
    if (status === 200) body = await res.json();
  } catch {
    // Fail closed: everything reads offline.
  } finally {
    clearTimeout(timer);
  }
  if (s.pollCtl !== ctl) return;
  s.pollCtl = null;
  s.states = L.readStatus(status, body, ids);
  render();
  if (!document.hidden) s.pollTimer = setTimeout(poll, config.pollIntervalMs);
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    clearTimeout(s.pollTimer);
    s.pollTimer = 0;
    if (s.pollCtl) s.pollCtl.abort();
    s.pollCtl = null;
  } else {
    poll();
  }
});

// ---------- start ----------

new ResizeObserver(layout).observe(el.carousel);
portraitQuery.addEventListener("change", layout);
reducedMotion.addEventListener("change", renderMedia);
layout();
render();
requestAnimationFrame(() => requestAnimationFrame(() => el.carousel.classList.add("is-ready")));
poll();
