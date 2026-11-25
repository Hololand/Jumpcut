# jumpcut.cloud

The Jumpcut homepage. Plain HTML, CSS and ES modules. No framework, no build step, no dependency, no analytics, no cookie.

## Purpose

The front door for iGaming operators, game studios and simulation teams. Three demo tiles sit in a vertical carousel, one per scene: Video Games, iGaming and Simulations. A visitor can play a live stream of a demo inside the featured tile, or ask for a demo by email.

## How it works

1. The page loads with iGaming in the middle. Video Games peeks above it and Simulations below. The featured scene shows its name and its three selling points as numbered rows: a large numeral (01, 02, 03) in the scene's accent, then the point in a strong weight, with thin rules between the rows.
2. Each scene has its own accent colours and backdrop: two soft pools of light and one faint pattern. Video Games is blue and violet over an arena floor grid, iGaming is sun gold and deep amber over faint card suits, and Simulations is alpine green and sky blue over a contour map. The backdrops sit in a fixed layer behind the page and crossfade when the carousel moves. The featured tile sits on a soft, tight shadow in its scene's accent with a faint accent edge, outside its edge and never over its picture, like a framed picture. The rows come in one after another. With reduced motion on, nothing fades or moves.
3. While the tab is visible, the page asks `GET https://rgs.jumpcut.cloud/v0/demo/status` for the demos' states, at once and then every 20 seconds. Anything unexpected reads as offline.
4. Each tile shows a preview and one action: "Play now" when its demo is online, a busy line when every seat is taken, and "Request a demo" (an email to sales) otherwise.
5. Nothing starts on its own. "Play now" sends `POST https://rgs.jumpcut.cloud/v0/demo/launch` with the game's id. The answer's `launchUrl` is framed only when its origin is exactly `https://play.jumpcut.cloud`. The framed page shows its own loading screen, then the game.
6. Nothing of ours is drawn over a playing stream. Its controls ("End demo", and "Full screen" where the browser offers the Fullscreen API) sit beside it.
6a. On a phone (the upright and short-landscape layouts), a playing stream takes over the window. The header, headline, info text, neighbours and footer step aside, and the featured tile is fixed to the window with one slim control area: a bar on top when upright, a rail on the left when sideways. The bar and rail never overlap the stream, and the safe-area insets are kept. Upright, the stream is taller than wide, so the game draws its phone layout. Only CSS changes (`body.play-window`, set by `site.js`), so rotating the phone swaps bar and rail without reloading the frame. While it plays, no wheel, swipe or key moves the carousel; "End demo" is the way out. A desktop keeps the stream in its tile.
6b. "Full screen" puts the featured tile (the frame's own parent, so the frame never moves) in the browser's fullscreen. Esc or the browser's controls leave it, and a stream that ends or "End demo" leaves it first.
7. Removing the frame ends the stream: the framed page notices it is unloading and ends its own session. That happens on "End demo" and whenever another tile moves into the middle.
8. When a stream ends for its own reasons, the framed page loads `ended.html?cpExit=<reason>`. That page tells the homepage through `postMessage`, and the homepage removes the frame and shows the preview again.
9. Wherever "Play now" shows, one small line under it reads "By playing you accept the demo terms", linking to `terms.html`. It shows only with "Play now", never while a demo starts or plays. A "Terms and credits" link is always present: in the footer, and in the top bar on a phone held upright, where the footer is hidden.
10. `terms.html` holds the demo terms and the credits the engine and content licences ask for. It is plain HTML with no script, and it may scroll.

The terms and credits were published on 19 November 2026 with Holland's yes. A change to their wording needs his yes again. The Unreal notice names the year as text ("Copyright 1998 – 2026"): update it each January.

Moving the carousel: the mouse wheel, a vertical swipe, the arrow and page keys, or a tap on a small tile. Each gesture moves one tile, and the carousel stops at both ends. While a demo plays, wheel and swipe inside it belong to the game.

## Files

| File | What it does |
| --- | --- |
| `index.html` | The page, its Content-Security-Policy and the three backdrop layers. Its first paint is iGaming's |
| `site.css` | All styles, with the layouts for desktop, phone upright and phone sideways. The scene colours, backdrops and glow are tweak points at the top; the backdrop patterns are SVG drawn for this site, inline as `data:` URIs |
| `site.js` | Builds the tiles and the selling-point rows, and wires input, status, launch and the frame |
| `carousel-logic.js` | Pure rules with no DOM: ends, status reading, launch URL check, wheel and swipe steps, tile sizing |
| `config.js` | Backend origins, sales address, timings and the tiles |
| `ended.html`, `ended.js`, `ended.css` | Where a framed stream lands when it ends; reports the reason to the homepage |
| `terms.html`, `terms.css` | Demo terms and credits, linked from the footer and from beside "Play now"; its own CSP allows no script |
| `media/` | Tile stills (SVG, drawn for this site) and the slot's preview videos and posters when present |
| `_dev/serve.mjs` | Local server and fake backend (not published) |
| `_dev/*.test.mjs` | Tests for `carousel-logic.js`, `config.js`, the first paint of `index.html`, and the terms page and links (not published) |
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

Then run the server and check the page at 1440x900, 1280x720, 844x390, 390x844 and 360x780, in every scene. The page must not scroll, and the featured tile must keep one size in all three scenes.

## Tweak points

| Setting | Where | Default | Effect |
| --- | --- | --- | --- |
| `rgsOrigin` | `config.js` | `https://rgs.jumpcut.cloud` | Where status and launch go. Also in the CSP `connect-src` in `index.html` |
| `playOrigin` | `config.js` | `https://play.jumpcut.cloud` | The only origin a launch URL may have. Also in the CSP `frame-src` |
| `salesEmail` | `config.js` | `sales@jumpcut.cloud` | Where "Request a demo" goes |
| `pollIntervalMs` | `config.js` | 20000 | How often the status is read while the tab is visible |
| `statusTimeoutMs`, `launchTimeoutMs` | `config.js` | 8000, 15000 | When a status read or launch counts as failed |
| `featuredOnLoad` | `config.js` | `hello` | The tile in the middle on load |
| `tiles` | `config.js` | Video Games, iGaming, Simulations | Order, ids, names, media and three `points` each, every point `{ text }`, one line, shown beside its number. The ids (`lyra`, `hello`, `airsim`) are the backend's game ids, so they stay |
| `--ground-<id>` | `site.css`, top of the file | `#eef0fa`, `#f8f3e9`, `#eef4f0` | Each scene's page colour. Keep it light: all text is ink on it |
| `--accent-<id>`, `--second-<id>` | `site.css`, top of the file | blue `#3b5cff` and violet `#8a5cf5`; gold `#e3a21a` and amber `#d9822b`; green `#2f9e5e` and sky `#3b9fe0` | The scene's two colours: the pools, the glow, the numerals and the short stroke on the rule |
| `--deep-<id>` | `site.css`, top of the file | `#2b3bb3`, `#8a5a00`, `#1d6a3f` | The position number. Keep it dark enough to read on the page |
| `--pool-<id>` | `site.css`, top of the file | 26%, 32%, 28% | How strong the two pools of light are at their centres |
| `--pattern-<id>`, `--pattern-upright` | `site.css`, top of the file | .13, .17, .11; .7 on an upright phone | How visible the floor grid, card suits and contours are. Upright phones multiply by `--pattern-upright`, because the text sits on the patterns there |
| `--glow-edge`, `--glow-halo`, `--glow-blur` | `site.css`, top of the file | 38%, 26%, 26px (16px on phones) | The featured tile's faint accent edge, its soft coloured shadow and how far the shadow spreads |
| `--halo-room` | `site.css`, top of the file and per layout | up to 40px on desktop; 1rem upright; 1.1rem sideways | Room beside the tile for the halo. Keep it at or below the gap beside the carousel, so the carousel never covers the text column |
| `--scene-fade`, `--row-stagger` | `site.css`, top of the file | 600ms, 60ms | How long a backdrop crossfade and glow change take, and the delay between the rows coming in |
| `--peek`, `--gap`, `--scale` | `site.css` | per layout | How much of the neighbours shows, the space between tiles, their size |
| `--glide` | `site.css` | 350ms | How long a move takes |
| `--bar`, `--rail` | `site.css` | 3.4rem, 8.25rem | While a phone plays full-window: the height of the top bar (upright) and the width of the side rail (sideways) that hold End demo and Full screen |
| Wheel threshold and quiet gap | `wheelStep` in `carousel-logic.js` | 24 px, 180 ms | What counts as one wheel gesture |
| Swipe threshold | `swipeStep` in `carousel-logic.js` | 40 px | How far a finger travels for one step |

## Publishing

GitHub Pages builds this repo from `main` with Jekyll. Anything pushed to `main` is live at https://jumpcut.cloud within minutes. Work on a branch and open a pull request. Jekyll does not publish files or folders whose names start with `_`, `.` or `#`, so `_dev/` stays out of the site.

## No secrets, ever

This repo is public. It never holds a key, token, password, account number, internal address or AWS identifier. The only backend addresses are the public hostnames in `config.js`.

## Known limits

- iPhone Safari has no fullscreen for an element, so "Full screen" does not show there. The full-window play fills the page area instead, and Safari's own bars stay.
- Under 24 rem of height (a phone on its side with Safari's bars showing) the footer gives way to the top bar's Terms and email links, and the text column tightens.
- Video Games and Simulations are live demos but show a still, not a video: their preview clips are not made yet.
- The selling points are three one-line rows on every layout, so the tile keeps its size between scenes. A longer point must still fit one line at 360 px wide, and a fourth one needs the tile's room rechecked on upright phones.
- The backdrop patterns are fixed drawings inside `site.css`. Their strength is a tweak point; changing their shape means new SVG path data.
- A meta Content-Security-Policy cannot set `frame-ancestors`; that needs a response header, which GitHub Pages does not offer.
