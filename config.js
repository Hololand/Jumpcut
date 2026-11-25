// Everything the homepage can be tuned by. The backend addresses live here
// and only here; the page never reads them from its own URL.
// _dev/serve.mjs swaps the two origins for local ones while developing.

export const config = Object.freeze({
  rgsOrigin: "https://rgs.jumpcut.cloud",
  playOrigin: "https://play.jumpcut.cloud",
  salesEmail: "sales@jumpcut.cloud",

  pollIntervalMs: 20000,
  statusTimeoutMs: 8000,
  launchTimeoutMs: 15000,

  // The tile in the middle when the page loads.
  featuredOnLoad: "hello",

  // In carousel order, top to bottom. Each point is `{ text }`: one line, which shows beside
  // its number (01, 02, 03).
  tiles: Object.freeze([
    {
      id: "lyra",
      name: "Video Games",
      points: [
        { text: "Play before the download finishes" },
        { text: "Drives player acquisition" },
        { text: "Safe from decompilation" },
      ],
      media: {
        still: "media/game.svg",
        landscape: { video: "media/game-landscape.mp4", poster: "media/game-landscape.jpg" },
        portrait: { video: "media/game-portrait.mp4", poster: "media/game-portrait.jpg" },
      },
    },
    {
      id: "hello",
      name: "iGaming",
      points: [
        { text: "Industry-leading quality" },
        { text: "Instant time to fun" },
        { text: "Tamper-proof by design" },
      ],
      media: {
        still: "media/slot.svg",
        landscape: { video: "media/slot-landscape.mp4", poster: "media/slot-landscape.jpg" },
        portrait: { video: "media/slot-portrait.mp4", poster: "media/slot-portrait.jpg" },
      },
    },
    {
      id: "airsim",
      name: "Simulations",
      points: [
        { text: "Secure: nothing runs on the device" },
        { text: "Anywhere with an internet connection" },
        { text: "Any device, no special hardware" },
      ],
      media: {
        still: "media/drone.svg",
        landscape: { video: "media/drone-landscape.mp4", poster: "media/drone-landscape.jpg" },
        portrait: { video: "media/drone-portrait.mp4", poster: "media/drone-portrait.jpg" },
      },
    },
  ]),
});
