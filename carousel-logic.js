// Pure rules for the homepage carousel. No DOM here, so every rule can be
// tested with node --test (see _dev/carousel-logic.test.mjs).

export const TILE_STATES = Object.freeze(["offline", "busy", "online"]);

// The reasons the play page may report when its stream ends. Anything else
// is treated as an ordinary end, so a strange value never changes behaviour.
export const END_REASONS = Object.freeze([
  "player_exit",
  "idle",
  "heartbeat_lost",
  "error",
  "no_capacity",
  "stream_ended",
]);

// Keep an index inside the list. The carousel stops at both ends: no looping.
export function clampIndex(index, count) {
  if (!Number.isInteger(count) || count < 1) return 0;
  if (!Number.isFinite(index)) return 0;
  return Math.min(count - 1, Math.max(0, Math.trunc(index)));
}

// Move at most one tile, whatever the size of the step asked for.
export function stepIndex(index, step, count) {
  return clampIndex(clampIndex(index, count) + Math.sign(step || 0), count);
}

// A game's state from the status body. Fail closed: a missing game, a
// malformed body or an unknown state all read as offline.
export function tileState(body, id) {
  if (!body || typeof body !== "object" || !Array.isArray(body.games)) return "offline";
  const game = body.games.find((g) => g && typeof g === "object" && g.id === id);
  if (!game) return "offline";
  return TILE_STATES.includes(game.state) ? game.state : "offline";
}

// Every tile's state from one status answer. Anything but a 200 is offline.
export function readStatus(httpStatus, body, ids) {
  const ok = httpStatus === 200;
  const states = {};
  for (const id of ids) states[id] = ok ? tileState(body, id) : "offline";
  return states;
}

// The launch URL is framed only when its origin is exactly the play origin.
// Returns the URL to frame, or null.
export function checkLaunchUrl(value, playOrigin) {
  if (typeof value !== "string" || typeof playOrigin !== "string") return null;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  if (url.origin !== playOrigin) return null;
  return url.href;
}

// What to do with a launch answer: play, or which message to show.
export function launchOutcome(httpStatus, body, playOrigin) {
  if (httpStatus === 200) {
    const url = checkLaunchUrl(body && body.launchUrl, playOrigin);
    return url ? { kind: "play", url } : { kind: "failed" };
  }
  const code = body && body.error && typeof body.error === "object" ? body.error.code : undefined;
  if (httpStatus === 503 && code === "demos_offline") return { kind: "offline" };
  if (httpStatus === 503 && code === "demos_busy") return { kind: "busy" };
  if (httpStatus === 429) return { kind: "rate_limited" };
  return { kind: "failed" };
}

// Resource hints that get the browser ready before the click, and nothing
// more: no launch, no ticket, no stream request, no frame. Only while the
// featured tile is online and still shows its preview. One hint: a
// preconnect to the play page's origin, so the frame's first request finds
// a warm connection. The frame shares this page's top-level site, so the
// connection is in the same partition. Checked on MDN, 27 November 2026:
// https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/rel/preconnect
// and, for partitioning, .../Web/Privacy/Guides/State_Partitioning.
// No preload, modulepreload or prefetch of the play page's script. Its HTML
// and config are no-store, which no cache may store
// (.../Web/HTTP/Reference/Headers/Cache-Control). Its script and the SDK may
// be served no-store, or under content-hashed names with a long cache life,
// depending on the stack's release. Either way this page cannot name them:
// the hashed names are known only to the play page's own HTML, which
// already preloads them all in one round. A modulepreload here would also
// fill this document's module map, which the frame does not share.
export function warmHints(phase, state, playOrigin) {
  if (phase !== "preview" || state !== "online") return [];
  if (typeof playOrigin !== "string" || !/^https?:\/\/[^/]+$/.test(playOrigin)) return [];
  return [{ rel: "preconnect", href: playOrigin }];
}

// What the homepage tells the frame once it has loaded: the time the
// visitor pressed Play now, so the play page can time the click to its
// first frame. A time and nothing else.
export function clickMessage(at) {
  return { type: "cp-click", at };
}

// The "By playing you accept the demo terms" line goes with Play now only:
// a preview of an online demo. Never while launching or over a stream.
export function showsConsent(phase, state) {
  return phase === "preview" && state === "online";
}

// The end reason ended.html passes on.
export function endReason(value) {
  return END_REASONS.includes(value) ? value : "stream_ended";
}

// Wheel deltas arrive in pixels, lines or pages. Turn them into pixels.
export function wheelPixels(delta, deltaMode, pageHeight) {
  const d = Number.isFinite(delta) ? delta : 0;
  if (deltaMode === 1) return d * 16;
  if (deltaMode === 2) return d * (Number.isFinite(pageHeight) ? pageHeight : 800);
  return d;
}

export function createWheelState() {
  return { acc: 0, locked: false, lastTime: -Infinity };
}

// One step per wheel gesture, however hard it is flung. Small deltas add up
// until they pass the threshold; then the gesture is spent until the wheel
// has been quiet for quietMs, which swallows a trackpad's inertia tail.
export function wheelStep(state, { deltaY, time }, { threshold = 24, quietMs = 180 } = {}) {
  const quiet = !(time - state.lastTime < quietMs);
  if (state.locked && !quiet) {
    return { state: { acc: 0, locked: true, lastTime: time }, step: 0 };
  }
  let acc = quiet ? 0 : state.acc;
  const dy = Number.isFinite(deltaY) ? deltaY : 0;
  if (Math.sign(acc) !== Math.sign(dy)) acc = 0;
  acc += dy;
  if (Math.abs(acc) >= threshold) {
    return { state: { acc: 0, locked: true, lastTime: time }, step: Math.sign(acc) };
  }
  return { state: { acc, locked: false, lastTime: time }, step: 0 };
}

// One step per vertical swipe. A finger moving up brings the next tile in.
export function swipeStep(dx, dy, threshold = 40) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return 0;
  if (Math.abs(dy) < threshold || Math.abs(dy) <= Math.abs(dx)) return 0;
  return dy < 0 ? 1 : -1;
}

export function keyStep(key) {
  if (key === "ArrowDown" || key === "PageDown") return 1;
  if (key === "ArrowUp" || key === "PageUp") return -1;
  return 0;
}

// Where a tile sits relative to the featured one, from -2 to 2. Anything
// further away is parked out of sight with the outer tiles.
export function slotOffset(tileIndex, featuredIndex) {
  return Math.max(-2, Math.min(2, tileIndex - featuredIndex));
}

export function positionLabel(index, count) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(clampIndex(index, count) + 1)} / ${pad(Math.max(1, count))}`;
}

// Size the featured tile inside the carousel box. Landscape is 16:9 fitted to
// the box. Portrait takes the full width and as much height as the peeks of
// the neighbours leave, up to 9:16. shift is how far a neighbour's centre sits
// from the featured tile's centre.
export function fitTile(box, mode, { gap = 16, peek = 56, scale = 0.84 } = {}) {
  const width = Math.max(0, box.width || 0);
  const height = Math.max(0, box.height || 0);
  const room = Math.max(0, height - 2 * (gap + peek));
  let w;
  let h;
  if (mode === "portrait" && room >= (width * 9) / 16) {
    w = width;
    h = Math.min(room, (width * 16) / 9);
  } else {
    h = Math.min(room, (width * 9) / 16);
    w = (h * 16) / 9;
  }
  const shift = h / 2 + gap + (h * scale) / 2;
  return { width: Math.round(w), height: Math.round(h), shift: Math.round(shift), scale };
}

// A phone shows a playing stream in the whole window: the stream plays and
// one of the phone layouts is showing. A desktop keeps the tile in the carousel.
export function playsInWindow(phase, phoneLayout) {
  return phase === "playing" && phoneLayout === true;
}

// Whether the browser can put one element in fullscreen. iPhone Safari cannot,
// and the button stays away there.
export function fullscreenSupported(doc) {
  return Boolean(doc && (doc.fullscreenEnabled || doc.webkitFullscreenEnabled));
}
