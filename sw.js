/* Colven board as an installable app.
   The page itself is fetched fresh whenever there is signal (so updates show right away) and kept for when there is none;
   icons, the logo, fonts and the libraries are kept after the first visit. Calls to the database are never cached. */
var CACHE = "colven-v3";
var CORE = ["./", "./index.html", "./manifest.webmanifest", "./assets/colven-logo.png", "./assets/app-icon-192.png", "./assets/app-icon-512.png", "./assets/favicon-32.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(CORE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (/supabase\.co$/.test(url.hostname)) return;
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).then(function (res) {
      var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put("./index.html", copy); });
      return res;
    }).catch(function () { return caches.match("./index.html").then(function (r) { return r || caches.match("./"); }); }));
    return;
  }
  var cacheable = url.origin === self.location.origin || /(^|\.)jsdelivr\.net$|fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!cacheable) return;
  e.respondWith(caches.match(req).then(function (hit) {
    var net = fetch(req).then(function (res) {
      if (res && (res.ok || res.type === "opaque")) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () { return hit; });
    return hit || net;
  }));
});

/* Meeting reminders: the function `recordatorios` in Supabase sends { title, body, tag, url, alarm } before each meeting.
   They act like an alarm: a long vibration, the notice stays until it is dismissed, and opening it shows the meeting full screen
   in the board (`alarm` carries what that screen needs). If the board is already open, it shows that screen right away. */
// "Posponer 5 min" asks the function `recordatorios` to send the same notice again in 5 minutes (public project URL and key)
var SB_FN = "https://twtenusvpnqntkeiejvk.supabase.co/functions/v1/recordatorios", SB_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR3dGVudXN2cG5xbnRrZWllanZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE5OTU1NjcsImV4cCI6MjEwNzU3MTU2N30.wXljnWHst2x4TwtjE_K319ffis3jxvuj55FQJ_3MyAM";
self.addEventListener("push", function (e) {
  var d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : "" }; }
  var opts = {
    body: d.body || "",
    tag: d.tag || undefined,
    icon: "assets/app-icon-192.png",
    badge: "assets/favicon-32.png",
    data: { url: d.url || "./#calendario", alarm: d.alarm || null, payload: d },
    renotify: !!d.tag
  };
  if (d.alarm) {
    opts.requireInteraction = true;
    opts.vibrate = [500, 250, 500, 250, 900];
    opts.actions = [{ action: "snooze", title: "Posponer 5 min" }, { action: "done", title: "Listo" }];
  }
  e.waitUntil(Promise.all([
    self.registration.showNotification(d.title || "Reunión", opts),
    d.alarm ? self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      list.forEach(function (c) { if (c.visibilityState === "visible") c.postMessage({ type: "alarma", alarm: d.alarm, live: true }); });
    }) : null
  ]));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  if (e.action === "done") return;
  var data = e.notification.data || {}, alarm = data.alarm;
  if (e.action === "snooze") { e.waitUntil(snooze(data.payload)); return; }
  var url = new URL(data.url || "./#calendario", self.registration.scope);
  if (alarm) url.searchParams.set("alarma", JSON.stringify(alarm));
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      var c = list[i];
      if (c.url.indexOf(self.registration.scope) === 0 && "focus" in c) {
        if (alarm) c.postMessage({ type: "alarma", alarm: alarm });
        return c.focus();
      }
    }
    return self.clients.openWindow(url.href);
  }));
});
function snooze(payload) {
  return self.registration.pushManager.getSubscription().then(function (sub) {
    if (!sub || !payload) return;
    return fetch(SB_FN, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SB_ANON, Authorization: "Bearer " + SB_ANON },
      body: JSON.stringify({ snooze: true, endpoint: sub.endpoint, payload: payload })
    });
  }).catch(function () {});
}
