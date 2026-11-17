# jumpcut.cloud

The Jumpcut homepage. Plain HTML, CSS and ES modules. No framework, no build step, no dependency, no analytics, no cookie.

## Purpose

The front door for iGaming operators, game studios and simulation teams. Three demo tiles sit in a vertical carousel: Game, Slot and Drone. A visitor can play a live stream of a demo inside the featured tile, or ask for a demo by email.

## How it works

1. The page loads with Slot in the middle. Game peeks above it and Drone below.
2. While the tab is visible, the page asks `GET https://rgs.jumpcut.cloud/v0/demo/status` for the demos' states, at once and then every 20 seconds. Anything unexpected reads as offline.
3. Each tile shows a preview and one action: "Play now" when its demo is online, a busy line when every seat is taken, and "Request a demo" (an email to sales) otherwise.
4. Nothing starts on its own. "Play now" sends `POST https://rgs.jumpcut.cloud/v0/demo/launch` with the game's id. The answer's `launchUrl` is framed only when its origin is exactly `https://play.jumpcut.cloud`. The framed page shows its own loading screen, then the game.
5. Nothing of ours is drawn over a playing stream. Its controls ("End demo") sit beside it.
6. Removing the frame ends the stream: the framed page notices it is unloading and ends its own session. That happens on "End demo" and whenever another tile moves into the middle.
7. When a stream ends for its own reasons, the framed page loads `ended.html?cpExit=<reason>`. That page tells the homepage through `postMessage`, and the homepage removes the frame and shows the preview again.

Moving the carousel: the mouse wheel, a vertical swipe, the arrow and page keys, or a tap on a small tile. Each gesture moves one tile, and the carousel stops at both ends. While a demo plays, wheel and swipe inside it belong to the game.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The page and its Content-Security-Policy |
| `site.css` | All styles, with the layouts for desktop, phone upright and phone sideways |
| `site.js` | Builds the tiles and wires input, status, launch and the frame |
| `carousel-logic.js` | Pure rules with no DOM: ends, status reading, launch URL check, wheel and swipe steps, tile sizing |
| `config.js` | Backend origins, sales address, timings and the tiles |
| `ended.html`, `ended.js`, `ended.css` | Where a framed stream lands when it ends; reports the reason to the homepage |
| `media/` | Tile stills (SVG, drawn for this site) and the slot's preview videos and posters when present |
| `_dev/serve.mjs` | Local server and fake backend (not published) |
| `_dev/*.test.mjs` | Tests for `carousel-logic.js` and `config.js` (not published) |
| `CNAME`, `favicon.ico`, `logo.png` | Domain and icons |

## How to run

Needs Node 22.12 or later. From the repo root:

```
node _dev/serve.mjs
```

Open http://127.0.0.1:8600. The fake backend runs at http://127.0.0.1:8601. When serving `index.html` and `config.js` the script swaps the production origins for local ones, so the page talks to the fake backend.

Switch the fake backend's state in another tab or with curl:

- `http://127.0.0.1:8601/_dev/state?all=online` (or `offline`, `busy`, `fail` for a 500)
- `http://127.0.0.1:8601/_dev/state?hello=busy` (one game)
- `http://127.0.0.1:8601/_dev/state?launch=rate_limited` (or `error`, `wrong_origin`, `ok`)
- `http://127.0.0.1:8601/_dev/state?exit=no_capacity` (the reason the fake play page's end button reports)
- `http://127.0.0.1:8601/_dev/log` (status reads, launches, frames loaded, frames ended)
- `http://127.0.0.1:8601/_dev/reset`

Environment: `DEV_SITE_PORT` (8600), `DEV_FAKE_PORT` (8601), `DEV_RGS_ORIGIN` and `DEV_PLAY_ORIGIN` (both default to the fake backend; point them at a real local stack to try it).

## How to test

```
node --test "_dev/*.test.mjs"
```

Then run the server and check the page at 1440x900, 390x844 and 844x390.

## Tweak points

| Setting | Where | Default | Effect |
| --- | --- | --- | --- |
| `rgsOrigin` | `config.js` | `https://rgs.jumpcut.cloud` | Where status and launch go. Also in the CSP `connect-src` in `index.html` |
| `playOrigin` | `config.js` | `https://play.jumpcut.cloud` | The only origin a launch URL may have. Also in the CSP `frame-src` |
| `salesEmail` | `config.js` | `sales@jumpcut.cloud` | Where "Request a demo" goes |
| `pollIntervalMs` | `config.js` | 20000 | How often the status is read while the tab is visible |
| `statusTimeoutMs`, `launchTimeoutMs` | `config.js` | 8000, 15000 | When a status read or launch counts as failed |
| `featuredOnLoad` | `config.js` | `hello` | The tile in the middle on load |
| `tiles` | `config.js` | Game, Slot, Drone | Order, ids, names, pitch lines and media |
| `--peek`, `--gap`, `--scale` | `site.css` | per layout | How much of the neighbours shows, the space between tiles, their size |
| `--glide` | `site.css` | 350ms | How long a move takes |
| Wheel threshold and quiet gap | `wheelStep` in `carousel-logic.js` | 24 px, 180 ms | What counts as one wheel gesture |
| Swipe threshold | `swipeStep` in `carousel-logic.js` | 40 px | How far a finger travels for one step |

## Publishing

GitHub Pages builds this repo from `main` with Jekyll. Anything pushed to `main` is live at https://jumpcut.cloud within minutes. Work on a branch and open a pull request. Jekyll does not publish files or folders whose names start with `_`, `.` or `#`, so `_dev/` stays out of the site.

## No secrets, ever

This repo is public. It never holds a key, token, password, account number, internal address or AWS identifier. The only backend addresses are the public hostnames in `config.js`.

## Known limits

- Game and Drone have no server yet, so they always read offline and show a still.
- The slot's preview videos and posters are added by another task. Until then the slot shows its still.
- A meta Content-Security-Policy cannot set `frame-ancestors`; that needs a response header, which GitHub Pages does not offer.
