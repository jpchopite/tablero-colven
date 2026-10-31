/* Design previewer: a small floating menu that swaps the board's colour and style skin (skins.css).
   It only sets data-skin and data-mode on <html> and loads the skin's fonts; the board itself is untouched.
   The choice is kept per device in localStorage ("tb-skin"); ?skin=<id> in the address also picks one. */
(function () {
  "use strict";
  var SKINS = [
    { id: "", name: "Original", desc: "El tablero tal como es hoy.", sw: ["#121a41", "#ffd453"] },
    { id: "nitido", name: "Nítido", desc: "Frío y calmo: sin puntos de fondo, columnas neutras, letra Geist.", sw: ["#f3f4f7", "#121a41"], font: "Geist:wght@400;500;600;700" },
    { id: "arena", name: "Arena", desc: "Cálido como papel, encabezado claro, todo muy redondeado.", sw: ["#f5f1e9", "#24211c"], font: "Manrope:wght@400;500;600;700;800" },
    { id: "grafito", name: "Grafito", desc: "Suizo: blanco y negro, líneas finas, esquinas rectas.", sw: ["#ffffff", "#0a0a0a"], font: "Inter+Tight:wght@400;500;600;700" },
    { id: "marca", name: "Marca", desc: "Colven a todo volumen: menú amarillo, contornos y sombras navy.", sw: ["#ffd453", "#121a41"], font: "Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800" },
    { id: "aire", name: "Aire", desc: "Vidrio esmerilado sobre un fondo de color suave.", sw: ["#c9d0ff", "#ffe9a8"], font: "Geist:wght@400;500;600;700" },
    { id: "pro", name: "Pro", desc: "Compacto y denso, para ver más tarjetas de un vistazo.", sw: ["#18181d", "#5b5bd6"], font: "Inter:wght@400;500;600;700" },
    { id: "revista", name: "Revista", desc: "Editorial: titulares grandes con serifa y filetes negros.", sw: ["#ffffff", "#c8102e"], font: "Fraunces:opsz,wght@9..144,500;9..144,700;9..144,900&family=Inter:wght@400;500;600;700" },
    { id: "consola", name: "Consola", desc: "Terminal: todo monoespaciado, cuadrado, con corchetes.", sw: ["#1a1a14", "#ffd453"], font: "JetBrains+Mono:wght@400;500;600;700" }
  ];
  var root = document.documentElement, KEY = "tb-skin";

  function find(id) { for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) return SKINS[i]; return SKINS[0]; }
  function loadFont(s) {
    if (!s.font || document.querySelector('link[data-skin-font="' + s.id + '"]')) return;
    var l = document.createElement("link");
    l.rel = "stylesheet"; l.href = "https://fonts.googleapis.com/css2?family=" + s.font + "&display=swap"; l.setAttribute("data-skin-font", s.id);
    document.head.appendChild(l);
  }
  /* the board picks dark either from its own setting or from the device; mirror whichever it shows */
  var mq = window.matchMedia ? matchMedia("(prefers-color-scheme: dark)") : null;
  function syncMode() {
    var t = root.getAttribute("data-theme");
    var dark = t === "dark" || (t !== "light" && !!(mq && mq.matches));
    var m = dark ? "dark" : "light";
    if (root.getAttribute("data-mode") !== m) root.setAttribute("data-mode", m);
  }
  function apply(id, save) {
    var s = find(id);
    if (s.id) { loadFont(s); root.setAttribute("data-skin", s.id); } else root.removeAttribute("data-skin");
    syncMode();
    if (save) { try { if (s.id) localStorage.setItem(KEY, s.id); else localStorage.removeItem(KEY); } catch (e) {} }
    render();
  }
  var current = function () { return root.getAttribute("data-skin") || ""; };

  /* apply before the board paints */
  var first = "";
  try { var q = location.search.match(/[?&]skin=([a-z]*)/); first = q ? q[1] : localStorage.getItem(KEY) || ""; } catch (e) {}
  syncMode();
  if (first) { var s0 = find(first); if (s0.id) { loadFont(s0); root.setAttribute("data-skin", s0.id); } }
  if (mq && mq.addEventListener) mq.addEventListener("change", syncMode);
  if (window.MutationObserver) new MutationObserver(syncMode).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  /* ---------- the floating menu ---------- */
  var box, btn, menu, label;
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function render() {
    if (!menu) return;
    var s = find(current());
    label.textContent = s.name;
    Array.prototype.forEach.call(menu.querySelectorAll(".skin-item"), function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-id") === s.id)); });
  }
  function step(n) {
    var i = 0; for (var k = 0; k < SKINS.length; k++) if (SKINS[k].id === current()) i = k;
    apply(SKINS[(i + n + SKINS.length) % SKINS.length].id, true);
  }
  function open(on) {
    menu.hidden = !on; btn.setAttribute("aria-expanded", String(on));
    if (on) { var c = menu.querySelector('[aria-checked="true"]') || menu.querySelector(".skin-item"); if (c) c.focus(); }
  }
  function build() {
    box = el("div", "skin-switch");
    btn = el("button", "skin-btn"); btn.type = "button"; btn.setAttribute("aria-haspopup", "true"); btn.setAttribute("aria-expanded", "false");
    btn.title = "Probar otros diseños del tablero";
    btn.appendChild(el("span", "sw")); btn.appendChild(el("small", null, "Diseño")); label = el("span"); btn.appendChild(label);
    menu = el("div", "skin-menu"); menu.hidden = true; menu.setAttribute("role", "menu"); menu.setAttribute("aria-label", "Diseños del tablero");
    var h = el("div", "skin-h"); h.appendChild(el("span", null, "Vista previa de diseños")); h.appendChild(el("span", null, "solo en este equipo")); menu.appendChild(h);
    SKINS.forEach(function (s) {
      var b = el("button", "skin-item"); b.type = "button"; b.setAttribute("role", "menuitemradio"); b.setAttribute("data-id", s.id);
      var dot = el("span", "skin-dot"); dot.style.background = "linear-gradient(135deg, " + s.sw[0] + " 0 50%, " + s.sw[1] + " 50% 100%)";
      var txt = el("span"); txt.appendChild(el("b", null, s.name)); txt.appendChild(el("span", null, s.desc));
      b.appendChild(dot); b.appendChild(txt);
      b.addEventListener("click", function () { apply(s.id, true); });
      menu.appendChild(b);
    });
    var foot = el("div", "skin-foot");
    var prev = el("button", null, "← Anterior"), next = el("button", null, "Siguiente →");
    prev.type = next.type = "button";
    prev.addEventListener("click", function () { step(-1); }); next.addEventListener("click", function () { step(1); });
    foot.appendChild(prev); foot.appendChild(next); menu.appendChild(foot);
    box.appendChild(menu); box.appendChild(btn);
    btn.addEventListener("click", function () { open(menu.hidden); });
    menu.addEventListener("keydown", function (e) {
      var items = Array.prototype.slice.call(menu.querySelectorAll(".skin-item")), i = items.indexOf(document.activeElement);
      if (e.key === "Escape") { e.stopPropagation(); open(false); btn.focus(); }
      else if (e.key === "ArrowDown" && i >= 0) { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === "ArrowUp" && i >= 0) { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    });
    document.addEventListener("pointerdown", function (e) { if (!menu.hidden && !box.contains(e.target)) open(false); });
    document.body.appendChild(box);
    render();
  }
  if (document.body) build(); else document.addEventListener("DOMContentLoaded", build);
})();
