/* Design options: a "Diseño" entry in the board's Opciones menu (window.tbSkins.open) that switches between the original look and Aire (skins.css),
   and turns the optional dock on or off: the sections as a floating bar at the bottom centre of the screen.
   It only sets data-skin, data-mode and data-dock on <html>; the dock's buttons press the board's own section buttons,
   so the board itself is untouched. Choices are kept per device ("tb-skin", "tb-dock"); ?skin=aire and ?dock=1 also work. */
(function () {
  "use strict";
  var SKINS = [
    { id: "", name: "Original", desc: "El tablero tal como es hoy.", sw: ["#121a41", "#ffd453"] },
    { id: "aire", name: "Aire", desc: "Vidrio esmerilado sobre un fondo de color suave.", sw: ["#c9d0ff", "#ffe9a8"], font: "Geist:wght@400;500;600;700" },
    { id: "linea", name: "Línea", desc: "Bordes finos, letra más ligera y el amarillo solo para la acción principal.", sw: ["#0e1230", "#ffd453"] },
    /* the three redesign proposals (designs.css): the board laid out like a company website; ?design=a|b|c opens one without saving it */
    { id: "corporativo", name: "A · Corporativo", desc: "Como el sitio de una consultora: portada con foto, blanco y titulares grandes.", sw: ["#ffffff", "#0d1330"], font: "Manrope:wght@400;500;600;700;800", web: true },
    { id: "energia", name: "B · Energía", desc: "Como el sitio de una petrolera: bloques de color, formas redondeadas y foto.", sw: ["#ffd453", "#121a41"], font: "Plus+Jakarta+Sans:wght@400;500;600;700;800", web: true },
    { id: "financiero", name: "C · Financiero", desc: "Como el sitio de un banco de inversión: azul profundo, cifras finas y líneas.", sw: ["#0b1028", "#ffd453"], font: "Inter:wght@200;300;400;500;600;700", web: true }
  ];
  var DESIGNS = { a: "corporativo", b: "energia", c: "financiero" };
  var root = document.documentElement, KEY = "tb-skin", DOCK = "tb-dock";

  function find(id) { for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) return SKINS[i]; return SKINS[0]; }
  function save(k, v) { try { if (v) localStorage.setItem(k, v); else localStorage.removeItem(k); } catch (e) {} }
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
    var m = t === "dark" || (t !== "light" && !!(mq && mq.matches)) ? "dark" : "light";
    if (root.getAttribute("data-mode") !== m) root.setAttribute("data-mode", m);
  }
  function setSkin(id) {
    var s = find(id);
    if (s.id) { loadFont(s); root.setAttribute("data-skin", s.id); } else root.removeAttribute("data-skin");
    if (s.web) root.setAttribute("data-web", ""); else root.removeAttribute("data-web");
    syncMode();
  }
  function setDock(on) { if (on) root.setAttribute("data-dock", ""); else root.removeAttribute("data-dock"); }

  /* apply before the board paints */
  var first = "", dockFirst = false;
  try {
    var q = location.search.match(/[?&]skin=([a-z]*)/), d = location.search.match(/[?&]dock=([01])/), g = location.search.match(/[?&]design=([abc])/);
    first = g ? DESIGNS[g[1]] : q ? q[1] : localStorage.getItem(KEY) || "";
    dockFirst = d ? d[1] === "1" : localStorage.getItem(DOCK) === "1";
  } catch (e) {}
  setSkin(first); setDock(dockFirst);
  if (mq && mq.addEventListener) mq.addEventListener("change", syncMode);
  if (window.MutationObserver) new MutationObserver(syncMode).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }

  /* ---------- the dock: a copy of the sections that presses the board's own section buttons ---------- */
  var dock;
  function buildDock() {
    var side = document.getElementById("side");
    if (!side) return;
    dock = el("nav", "dock"); dock.setAttribute("aria-label", "Secciones");
    var src = side.querySelectorAll(".side-nav [data-v]");
    Array.prototype.forEach.call(src, function (b, i) {
      if (i === 2) {
        var add = el("button", "dock-add"); add.type = "button"; add.setAttribute("aria-label", "Agregar"); add.title = "Agregar";
        add.innerHTML = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
        add.addEventListener("click", function () { var a = document.getElementById("bnavAdd"); if (a) a.click(); });
        dock.appendChild(add);
      }
      var c = el("button"); c.type = "button"; c.setAttribute("data-v", b.getAttribute("data-v"));
      var ico = b.querySelector("svg"); if (ico) c.appendChild(ico.cloneNode(true));
      var name = b.textContent.trim(), short = { "Documentos": "Docs" }[name];
      c.appendChild(el("span", short ? "dl-long" : null, name)); if (short) { c.appendChild(el("span", "dl-short", short)); c.setAttribute("aria-label", name); }
      /* press the bottom bar's copy: the side menu ignores clicks while it is tucked away on Tablero */
      var target = document.querySelector('#bnav [data-v="' + b.getAttribute("data-v") + '"]') || b;
      c.addEventListener("click", function () { target.click(); });
      dock.appendChild(c);
    });
    document.body.appendChild(dock);
    var sync = function () {
      Array.prototype.forEach.call(src, function (b) {
        var c = dock.querySelector('[data-v="' + b.getAttribute("data-v") + '"]');
        if (b.getAttribute("aria-current") === "page") c.setAttribute("aria-current", "page"); else c.removeAttribute("aria-current");
      });
    };
    sync();
    if (window.MutationObserver) new MutationObserver(sync).observe(side, { subtree: true, attributes: true, attributeFilter: ["aria-current"] });
  }

  /* ---------- the "Diseño" menu, opened from Opciones and placed under that button ---------- */
  var btn, menu;
  function render() {
    if (!menu) return;
    var cur = root.getAttribute("data-skin") || "";
    Array.prototype.forEach.call(menu.querySelectorAll("[data-id]"), function (b) { b.setAttribute("aria-checked", String(b.getAttribute("data-id") === cur)); });
    menu.querySelector("[data-dock-toggle]").setAttribute("aria-checked", String(root.hasAttribute("data-dock")));
  }
  var phone = function () { return !!(window.matchMedia && matchMedia("(max-width: 680px)").matches); };
  function place() {
    if (phone()) { menu.style.top = menu.style.left = ""; return; } /* a sheet at the bottom, see skins.css */
    var r = btn.getBoundingClientRect(), w = menu.offsetWidth, vw = document.documentElement.clientWidth;
    menu.style.top = Math.round(r.bottom + 8) + "px";
    menu.style.left = Math.round(Math.max(12, Math.min(r.right - w, vw - w - 12))) + "px";
  }
  function open(on) {
    menu.hidden = !on; btn.setAttribute("aria-expanded", String(on));
    if (on) { place(); var c = menu.querySelector('[data-id][aria-checked="true"]') || menu.querySelector(".skin-item"); if (c) c.focus(); }
  }
  function item(role, title, desc, lead) {
    var b = el("button", "skin-item"); b.type = "button"; b.setAttribute("role", role);
    if (lead) b.appendChild(lead);
    var txt = el("span"); txt.appendChild(el("b", null, title)); txt.appendChild(el("span", null, desc));
    b.appendChild(txt); b.appendChild(el("span", "skin-tick"));
    menu.appendChild(b);
    return b;
  }
  function build() {
    btn = document.getElementById("optsBtn");
    if (!btn) return;

    menu = el("div", "skin-menu"); menu.hidden = true; menu.setAttribute("role", "menu"); menu.setAttribute("aria-label", "Diseño del tablero");
    var h = el("div", "skin-h"); h.appendChild(el("span", null, "Diseño")); h.appendChild(el("span", null, "solo en este equipo")); menu.appendChild(h);
    SKINS.forEach(function (s) {
      var dot = el("span", "skin-dot"); dot.style.background = "linear-gradient(135deg, " + s.sw[0] + " 0 50%, " + s.sw[1] + " 50% 100%)";
      var b = item("menuitemradio", s.name, s.desc, dot); b.setAttribute("data-id", s.id);
      b.addEventListener("click", function () { setSkin(s.id); save(KEY, s.id); render(); });
    });
    menu.appendChild(el("div", "skin-sep"));
    var t = item("menuitemcheckbox", "Dock de secciones", "Las secciones en una barra flotante abajo, al centro.");
    t.setAttribute("data-dock-toggle", "");
    t.addEventListener("click", function () { var on = !root.hasAttribute("data-dock"); setDock(on); save(DOCK, on ? "1" : ""); render(); });
    document.body.appendChild(menu);

    menu.addEventListener("keydown", function (e) {
      var items = Array.prototype.slice.call(menu.querySelectorAll(".skin-item")), i = items.indexOf(document.activeElement);
      if (e.key === "Escape") { e.stopPropagation(); open(false); btn.focus(); }
      else if (e.key === "ArrowDown" && i >= 0) { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === "ArrowUp" && i >= 0) { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === "Tab") open(false);
    });
    document.addEventListener("pointerdown", function (e) { if (!menu.hidden && !menu.contains(e.target)) open(false); });
    window.addEventListener("resize", function () { if (!menu.hidden) place(); });
    window.addEventListener("scroll", function () { if (!menu.hidden && !phone()) open(false); }, { passive: true });
    render();
    buildDock();
    window.tbSkins = { open: function () { setTimeout(function () { open(true); }, 0); } };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
