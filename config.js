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

  // In carousel order, top to bottom. Each point is a key into icons.js and
  // its line of text.
  tiles: Object.freeze([
    {
      id: "lyra",
      name: "Video Games",
      points: [
        { icon: "bolt", text: "Play before the download finishes" },
        { icon: "trend", text: "Drives player acquisition" },
        { icon: "codeShield", text: "Safe from decompilation" },
      ],
      media: { still: "media/game.svg" },
    },
    {
      id: "hello",
      name: "iGaming",
      points: [
        { icon: "sparkle", text: "Industry-leading quality" },
        { icon: "timer", text: "Instant time to fun" },
        { icon: "shieldCheck", text: "Tamper-proof by design" },
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
        { icon: "lock", text: "Secure: nothing runs on the device" },
        { icon: "globe", text: "Anywhere with an internet connection" },
        { icon: "devices", text: "Any device, no special hardware" },
      ],
      media: { still: "media/drone.svg" },
    },
  ]),
});
