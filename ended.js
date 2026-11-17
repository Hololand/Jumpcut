// The play page lands here, inside the homepage's frame, when a stream ends
// on its own. Tell the homepage why, then let it remove the frame.
import { endReason } from "./carousel-logic.js";

const reason = endReason(new URLSearchParams(location.search).get("cpExit"));

if (window.parent === window) {
  // Opened on its own, not in a frame: there is nothing to report to.
  location.replace("/");
} else {
  // Only a parent on this site's own origin receives it.
  window.parent.postMessage({ type: "cp-ended", reason }, location.origin);
}
