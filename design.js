/* Turns on the board's design (designs.css) before the board paints: data-skin="corporativo" and data-web on <html>,
   the Manrope font, and data-mode mirroring the light or dark mode the board shows (its own setting, or the device's).
   The earlier designs and the design menu are kept in archivo/disenos and are not loaded. */
(function () {
  "use strict";
  var root = document.documentElement;
  root.setAttribute("data-skin", "corporativo");
  root.setAttribute("data-web", "");
  var font = document.createElement("link");
  font.rel = "stylesheet"; font.href = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap";
  document.head.appendChild(font);
  var mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  function syncMode() {
    var t = root.getAttribute("data-theme");
    var m = t === "dark" || (t !== "light" && !!(mq && mq.matches)) ? "dark" : "light";
    if (root.getAttribute("data-mode") !== m) root.setAttribute("data-mode", m);
  }
  syncMode();
  if (mq && mq.addEventListener) mq.addEventListener("change", syncMode);
  if (window.MutationObserver) new MutationObserver(syncMode).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
})();
