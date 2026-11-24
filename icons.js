// Line icons drawn for this site. 24x24 grid, stroke only, round caps and joins.
// site.js builds each as an <svg viewBox="0 0 24 24"> with createElementNS and
// sets stroke and stroke-width itself, so no colour or size lives here.
const shield = "M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6z";

export const icons = Object.freeze({
  bolt: ["M13 2L4 14h7l-1 8 9-12h-7z"],
  trend: ["M3 17l6-6 4 4 8-8", "M15 7h6v6"],
  codeShield: [shield, "M10 9.5l-2.5 2.5 2.5 2.5", "M14 9.5l2.5 2.5-2.5 2.5"],
  sparkle: [
    "M10 4Q11 11 18 12Q11 13 10 20Q9 13 2 12Q9 11 10 4z",
    "M19 2Q19.5 4.5 22 5Q19.5 5.5 19 8Q18.5 5.5 16 5Q18.5 4.5 19 2z",
  ],
  timer: ["M4 13a8 8 0 1 0 16 0a8 8 0 1 0-16 0", "M10 2h4", "M12 2v3", "M12 13V9"],
  shieldCheck: [shield, "M8.5 12l2.5 2.5 4.5-5"],
  lock: [
    "M7 11h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-6a2 2 0 0 1 2-2z",
    "M8 11V7a4 4 0 0 1 8 0v4",
    "M12 15v2",
  ],
  globe: [
    "M2 12a10 10 0 1 0 20 0a10 10 0 1 0-20 0",
    "M12 2c3 3 4 6.5 4 10s-1 7-4 10c-3-3-4-6.5-4-10s1-7 4-10z",
    "M3.2 8.5h17.6",
    "M3.2 15.5h17.6",
  ],
  devices: [
    "M15 17H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3",
    "M8 21h4",
    "M10 17v4",
    "M16 11h4a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z",
  ],
});
