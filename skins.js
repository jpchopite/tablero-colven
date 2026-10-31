/* Design options: a "Diseño" button in the header that switches between the original look and Aire (skins.css),
   and turns the optional dock on or off: the sections as a floating bar at the bottom centre of the screen.
   It only sets data-skin, data-mode and data-dock on <html>; the dock's buttons press the board's own section buttons,
   so the board itself is untouched. Choices are kept per device ("tb-skin", "tb-dock"); ?skin=aire and ?dock=1 also work. */
(function () {
  "use strict";
  var SKINS = [
    { id: "", name: "Original", desc: "El tablero tal como es hoy.", sw: ["#121a41", "#ffd453"] },
    { id: "aire", name: "Aire", desc: "Vidrio esmerilado sobre un fondo de color suave.", sw: ["#c9d0ff", "#ffe9a8"], font: "Geist:wght@400;500;600;700" }
  ];
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
    syncMode();
  }
  function setDock(on) { if (on) root.setAttribute("data-dock", ""); else root.removeAttribute("data-dock"); }

  /* apply before the board paints */
  var first = "", dockFirst = false;
  try {
    var q = location.search.match(/[?&]skin=([a-z]*)/), d = location.search.match(/[?&]dock=([01])/);
    first = q ? q[1] : localStorage.getItem(KEY) || "";
    dockFirst = d ? d[1] === "1" : localStorage.getItem(DOCK) === "1";
  } catch (e) {}
  setSkin(first); setDock(dockFirst);
  if (mq && mq.addEventListener) mq.addEventListener("change", syncMode);
  if (window.MutationObserver) new MutationObserver(syncMode).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  var PALETTE = '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.7 1.7-1.7h2.2a4.3 4.3 0 0 0 4.3-4.3C21 6.7 17 3.5 12 3.5z"/><circle cx="7.5" cy="11.5" r="1.2"/><circle cx="10.5" cy="7.5" r="1.2"/><circle cx="15.5" cy="8" r="1.2"/></svg>';

  /* ---------- the dock: a copy of the side menu's sections that presses the side menu's own buttons ---------- */
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
      c.addEventListener("click", function () { b.click(); });
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

  /* ---------- the "Diseño" button in the header and its menu ---------- */
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
    var actions = document.querySelector(".hero-actions");
    if (!actions) return;
    btn = el("button", "hbtn skin-btn"); btn.type = "button"; btn.id = "skinBtn";
    btn.setAttribute("aria-haspopup", "menu"); btn.setAttribute("aria-expanded", "false"); btn.setAttribute("aria-label", "Diseño"); btn.title = "Diseño del tablero";
    btn.innerHTML = PALETTE + '<span class="t">Diseño</span>';
    var opts = document.getElementById("optsBtn");
    actions.insertBefore(btn, opts || null);

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

    btn.addEventListener("click", function () { open(menu.hidden); });
    menu.addEventListener("keydown", function (e) {
      var items = Array.prototype.slice.call(menu.querySelectorAll(".skin-item")), i = items.indexOf(document.activeElement);
      if (e.key === "Escape") { e.stopPropagation(); open(false); btn.focus(); }
      else if (e.key === "ArrowDown" && i >= 0) { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === "ArrowUp" && i >= 0) { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === "Tab") open(false);
    });
    document.addEventListener("pointerdown", function (e) { if (!menu.hidden && !menu.contains(e.target) && !btn.contains(e.target)) open(false); });
    window.addEventListener("resize", function () { if (!menu.hidden) place(); });
    /* on phones the header button is hidden; the Opciones menu gets a "Diseño" entry instead */
    var opts2 = document.getElementById("optsBtn");
    if (opts2) opts2.addEventListener("click", function () {
      setTimeout(function () {
        var m = document.getElementById("addMenu");
        if (!phone() || !m || m.querySelector(".skin-entry")) return;
        var b = el("button", "skin-entry"); b.type = "button"; b.setAttribute("role", "menuitem");
        var d = el("span", "am-ico"); d.innerHTML = PALETTE; b.appendChild(d); b.appendChild(document.createTextNode("Diseño"));
        b.addEventListener("click", function () { var s = document.getElementById("addScrim"); if (s) s.click(); setTimeout(function () { open(true); }, 0); });
        m.appendChild(b);
      }, 0);
    });
    window.addEventListener("scroll", function () { if (!menu.hidden && !phone()) open(false); }, { passive: true });
    render();
    buildDock();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build); else build();
})();
