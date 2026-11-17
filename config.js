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

  // In carousel order, top to bottom.
  tiles: Object.freeze([
    {
      id: "lyra",
      name: "Game",
      pitch: "Play instantly, before the download finishes.",
      media: { still: "media/game.svg" },
    },
    {
      id: "hello",
      name: "Slot",
      pitch: "Cinematic, instant time to fun.",
      media: {
        still: "media/slot.svg",
        landscape: { video: "media/slot-landscape.mp4", poster: "media/slot-landscape.jpg" },
        portrait: { video: "media/slot-portrait.mp4", poster: "media/slot-portrait.jpg" },
      },
    },
    {
      id: "airsim",
      name: "Drone",
      pitch: "Secure, any device, no hardware.",
      media: { still: "media/drone.svg" },
    },
  ]),
});
