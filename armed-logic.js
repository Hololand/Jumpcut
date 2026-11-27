// Connect before the click (Phase 7 speed): the pure rules for arming the
// featured tile. No DOM here, so every rule can be tested with node --test
// (see _dev/armed-logic.test.mjs). site.js runs the effects this returns.
//
// Arming does quietly what a click does: the launch call, then the frame,
// with "#armed" on the launch URL, under the tile's poster. The press only
// reveals it. It runs only when config.connectBeforeClick is true, which
// changes the Phase 6 rule "Nothing starts on its own", so it is Holland's
// decision and ships off.

// One arming machine for the page. stage is idle, dwell (the timer runs),
// launching (the launch call is out) or armed (a frame waits under the
// poster). visit is the featured tile's id. used is true once this visit of
// the tile has armed, or tried to, or played: a tile arms at most once per
// visit to the middle, so a disarm never leads to a second seat.
export function createArm() {
  return { stage: "idle", visit: null, used: false };
}

// The page as the machine sees it.
//   enabled  config.connectBeforeClick === true
//   featured the featured tile's id
//   state    its status: online, busy or offline
//   warm     true when its status says a waiting session is ready
//   phase    preview, launching or playing (site.js's own phase)
//   framed   true when a playing frame exists
//   hidden   document.hidden
export function canArm(arm, view) {
  return Boolean(view) && view.enabled === true && view.hidden !== true &&
    view.phase === "preview" && view.framed !== true &&
    view.state === "online" && view.warm === true && !arm.used;
}

// What it takes to undo a stage, as effects for site.js.
function teardown(stage) {
  if (stage === "dwell") return ["clearTimer"];
  if (stage === "launching") return ["abortLaunch"];
  if (stage === "armed") return ["removeFrame"];
  return [];
}

// One step of the machine. Events:
//   sync      anything the page shows may have changed (render, status, visibility)
//   dwell     the dwell timer fired
//   launched  the arming launch call answered: { ok, url }
//   ended     the armed frame reported cp-ended before the press
//   press     the visitor pressed Play now
// Effects, run by site.js in order: startTimer, clearTimer, launch,
// abortLaunch, frame (create the armed frame from event.url), removeFrame,
// reveal (lift the poster over the armed frame).
export function armStep(arm, event, view) {
  let a = { ...arm };
  const fx = [];
  const type = event && event.type;

  if (!view || view.enabled !== true) {
    // The switch is off: nothing runs. Anything left over is undone.
    fx.push(...teardown(a.stage));
    return { arm: { stage: "idle", visit: view ? view.featured : null, used: false }, effects: fx };
  }

  // A new tile in the middle is a new visit. The old one's arming goes.
  if (view.featured !== a.visit) {
    fx.push(...teardown(a.stage));
    a = { stage: "idle", visit: view.featured, used: false };
  }

  if (type === "press") {
    if (a.stage === "armed") fx.push("reveal");
    else fx.push(...teardown(a.stage));
    return { arm: { ...a, stage: "idle", used: true }, effects: fx };
  }

  if (type === "ended") {
    if (a.stage === "armed") {
      fx.push("removeFrame");
      a.stage = "idle";
    }
    return { arm: a, effects: fx };
  }

  if (type === "launched") {
    if (a.stage === "launching") {
      if (event.ok === true && typeof event.url === "string") {
        a.stage = "armed";
        fx.push("frame");
      } else {
        a.stage = "idle";
      }
    }
    return { arm: a, effects: fx };
  }

  if (type === "dwell") {
    if (a.stage === "dwell") {
      if (canArm(a, view)) {
        a.stage = "launching";
        a.used = true;
        fx.push("launch");
      } else {
        a.stage = "idle";
      }
    }
    return { arm: a, effects: fx };
  }

  // sync
  if (a.stage === "launching" || a.stage === "armed") {
    // warm counts only until the frame exists: an armed frame holds the seat
    // that made it true, so warm turning false is no reason to let it go.
    // While the launch call is out no seat is held yet, and a stream request
    // with no warm seat would only be refused.
    const lost = view.hidden === true || view.state !== "online" ||
      view.phase !== "preview" || view.framed === true ||
      (a.stage === "launching" && view.warm !== true);
    if (lost) {
      fx.push(...teardown(a.stage));
      a.stage = "idle";
    }
  } else if (a.stage === "dwell") {
    if (!canArm(a, view)) {
      fx.push("clearTimer");
      a.stage = "idle";
    }
  } else if (canArm(a, view)) {
    a.stage = "dwell";
    fx.push("startTimer");
  }
  return { arm: a, effects: fx };
}

// Each game's warm flag from one status answer. Only the boolean true counts:
// an older stack that sends no flag, a malformed body or anything but a 200
// all read as not warm.
export function readWarm(httpStatus, body, ids) {
  const ok = httpStatus === 200 && body && typeof body === "object" && Array.isArray(body.games);
  const warm = {};
  for (const id of ids) {
    const game = ok ? body.games.find((g) => g && typeof g === "object" && g.id === id) : undefined;
    warm[id] = Boolean(game) && game.warm === true;
  }
  return warm;
}

// The launch URL with the fragment that tells the play page it is armed.
// Any fragment already there is replaced, so the play page sees exactly
// "#armed". The fragment never reaches a server or a log.
export function armedUrl(launchUrl) {
  let url;
  try {
    url = new URL(launchUrl);
  } catch {
    return null;
  }
  url.hash = "armed";
  return url.href;
}

// What the homepage tells an armed frame when the visitor presses Play now:
// the press time, and nothing else.
export function revealMessage(at) {
  return { type: "cp-reveal", at };
}
