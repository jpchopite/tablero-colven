// Meeting reminders on phones (web push) for the team board.
// A job in the database calls this every minute with an empty body. For each device that turned reminders on (table push_subs)
// it sends a notification 60, 30 and/or 10 minutes before each meeting (`leads`), and, if `morning` is on, one at 7:00 with
// that day's meetings and events.
// The page calls it with { test: true, key, endpoint } to send a test notification to one device; that needs the team key.
import webpush from "npm:web-push@3.6.7";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// the VAPID pair lives in the locked table push_keys (only this function, with the service key, can read it);
// secrets VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY take precedence if they are ever set
let VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") || "";
let VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "https://jpchopite.github.io/tablero-colven/";
const BOARD = "https://jpchopite.github.io/tablero-colven/";
const UTC_OFFSET_HOURS = 4; // Venezuela is UTC-4 all year
const MODE: Record<string, string> = { presencial: "Presencial", video: "Videollamada", llamada: "Llamada" };
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };

type Rule = { freq?: string; interval?: number | string; weekdays?: number[]; monthMode?: string; monthDay?: number | string;
  monthDays?: number[]; nth?: number | string; weekday?: number | string; month?: number | string; startMonth?: number | string | null };
type Meeting = { title?: string; kind?: string; date?: string; endDate?: string; start?: string; end?: string; mode?: string; place?: string;
  status?: string; team?: string[]; repeat?: Rule; until?: string; skip?: string[]; _deleted?: boolean };
type Sub = { endpoint: string; p256dh: string; auth: string; member_key: string; scope: string; leads: number[]; morning: boolean };
const MORNING_HOUR = 7; // the day's summary goes out from 7:00 to 7:59, Caracas time, on the first run that sees it

/* ---------- dates: a "day" is a Date at UTC midnight, so no time zone gets in the way ---------- */
function parseDay(s?: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || "");
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (d: Date, n: number) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + n));
const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
const mIdx = (wd: number) => (wd + 6) % 7;

/* ---------- the board's repeat rules (same as nextAfter in index.html, without "after another card") ---------- */
function nthWeekday(y: number, m: number, nth: number, wd: number): Date | null {
  const first = new Date(Date.UTC(y, m, 1)); y = first.getUTCFullYear(); m = first.getUTCMonth();
  if (nth === -1) {
    const lastD = daysIn(y, m);
    return new Date(Date.UTC(y, m, lastD - ((new Date(Date.UTC(y, m, lastD)).getUTCDay() - wd + 7) % 7)));
  }
  const day = 1 + ((wd - first.getUTCDay() + 7) % 7) + (nth - 1) * 7;
  return day > daysIn(y, m) ? null : new Date(Date.UTC(y, m, day));
}
function dateInMonth(r: Rule, y: number, m: number): Date | null {
  const first = new Date(Date.UTC(y, m, 1)); y = first.getUTCFullYear(); m = first.getUTCMonth();
  if (r.monthMode === "nth") return nthWeekday(y, m, Number(r.nth), Number(r.weekday));
  const n = daysIn(y, m), d = Number(r.monthDay);
  return new Date(Date.UTC(y, m, d === -1 ? n : Math.min(Math.max(d, 1) || 1, n)));
}
function datesInMonth(r: Rule, y: number, m: number): Date[] {
  if (r.monthMode !== "days") { const one = dateInMonth(r, y, m); return one ? [one] : []; }
  const first = new Date(Date.UTC(y, m, 1)); y = first.getUTCFullYear(); m = first.getUTCMonth();
  const n = daysIn(y, m), seen: Record<number, 1> = {}, out: Date[] = [];
  let l = (Array.isArray(r.monthDays) ? r.monthDays : []).map(Number).filter((d) => d === -1 || (d >= 1 && d <= 31));
  if (!l.length) l = [1];
  for (const d of l) { const day = d === -1 ? n : Math.min(d, n); if (!seen[day]) { seen[day] = 1; out.push(new Date(Date.UTC(y, m, day))); } }
  return out.sort((a, b) => +a - +b);
}
function nextAfter(r: Rule, from: Date): Date | null {
  const n = Math.max(1, Math.min(99, parseInt(String(r.interval), 10) || 1));
  const ok = (x: Date | null) => !!x && x > from;
  if (r.freq === "day") return addDays(from, n);
  if (r.freq === "week") {
    const wds = (Array.isArray(r.weekdays) && r.weekdays.length ? r.weekdays : [from.getUTCDay()]).map(Number).sort((a, b) => mIdx(a) - mIdx(b));
    const ws = addDays(from, -mIdx(from.getUTCDay()));
    for (let i = 0; i < 1500; i += n) for (const wd of wds) { const c = addDays(ws, i * 7 + mIdx(wd)); if (ok(c)) return c; }
    return null;
  }
  if (r.freq === "month" && n > 1 && r.startMonth != null && r.startMonth !== "") {
    const sm = Number(r.startMonth) || 0;
    for (let i = 0; i < 1200; i++) {
      const abs = from.getUTCFullYear() * 12 + from.getUTCMonth() + i;
      if (((abs - sm) % n + n) % n !== 0) continue;
      for (const c of datesInMonth(r, from.getUTCFullYear(), from.getUTCMonth() + i)) if (ok(c)) return c;
    }
    return null;
  }
  if (r.freq === "month") {
    for (let i = 0; i < 1200; i += n) for (const c of datesInMonth(r, from.getUTCFullYear(), from.getUTCMonth() + i)) if (ok(c)) return c;
    return null;
  }
  if (r.freq === "year") {
    for (let i = 0; i < 200; i += n) { const c = dateInMonth(r, from.getUTCFullYear() + i, Number(r.month) || 0); if (ok(c)) return c; }
    return null;
  }
  return null;
}
const isSeries = (m: Meeting) => !!(m.repeat && ["day", "week", "month", "year"].includes(m.repeat.freq || ""));

/* the dates of a meeting between two days (inclusive), with a series' skipped dates and end date taken out */
export function datesBetween(m: Meeting, lo: string, hi: string): string[] {
  let d = parseDay(m.date);
  if (!d) return [];
  if (!isSeries(m)) return m.date! >= lo && m.date! <= hi ? [m.date!] : [];
  const skip = Array.isArray(m.skip) ? m.skip : [], last = m.until && m.until >= m.date! ? m.until : "9999-12-31", out: string[] = [];
  for (let n = 0; d && n < 5000; n++) {
    const ds = fmt(d);
    if (ds > hi || ds > last) break;
    if (ds >= lo && !skip.includes(ds)) out.push(ds);
    d = nextAfter(m.repeat!, d);
  }
  return out;
}
function hm(s?: string): [number, number] | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s || "");
  return m ? [Number(m[1]), Number(m[2])] : null;
}
// local Caracas date + time -> milliseconds
function startMs(date: string, t: [number, number]): number {
  const [y, mo, d] = date.split("-").map(Number);
  return Date.UTC(y, mo - 1, d, t[0] + UTC_OFFSET_HOURS, t[1]);
}
function inText(min: number): string {
  if (min <= 0) return "Empieza ahora";
  if (min < 60) return "Empieza en " + min + " min";
  const h = Math.floor(min / 60), r = min % 60;
  return "Empieza en " + h + " h" + (r ? " " + r + " min" : "");
}

const live = (m: Meeting) => !(m._deleted || m.kind === "note" || m.status === "cancelled" || m.status === "done");
// "las mías": meetings with this person in the team; a meeting with nobody marked is for everyone
const forSub = (s: Sub, m: Meeting) => {
  const team = Array.isArray(m.team) ? m.team : [];
  return s.scope === "all" || !s.member_key || !team.length || team.includes(s.member_key);
};
const titleOf = (m: Meeting) => m.title || (m.kind === "event" ? "Evento" : "Reunión");

/* everything that should go out now: before each meeting date, the most recent lead (60, 30 or 10 min) that has been reached
   and not sent yet, so a device that turns reminders on 25 minutes before a meeting gets one notice, not two */
export function dueReminders(meetings: { id: string; data: Meeting }[], subs: Sub[], sent: Set<string>, now: number) {
  const today = new Date(now - UTC_OFFSET_HOURS * 3600000);
  const lo = fmt(addDays(today, -1)), hi = fmt(addDays(today, 2));
  const out: { sub: Sub; occ: string; payload: Record<string, unknown> }[] = [];
  for (const row of meetings) {
    const m = row.data || {};
    if (!live(m)) continue;
    const st = hm(m.start);
    if (!st) continue; // all-day events have no time to count back from
    for (const day of datesBetween(m, lo, hi)) {
      const at = startMs(day, st);
      if (now >= at) continue;
      const occ = row.id + "@" + day + "@" + m.start;
      for (const s of subs) {
        if (!forSub(s, m)) continue;
        const reached = (s.leads || []).filter((l) => now >= at - l * 60000);
        if (!reached.length) continue;
        const lead = Math.min(...reached);
        if (sent.has(s.endpoint + " " + occ + "@" + lead)) continue;
        const en = hm(m.end);
        const where = m.mode === "video" ? "Videollamada" : m.place || (m.mode && m.mode !== "presencial" ? MODE[m.mode] : "");
        const body = [inText(Math.round((at - now) / 60000)), m.start + (en ? " a " + m.end : ""), where].filter(Boolean).join(" · ");
        // same tag for every lead of a meeting date, so the newer notice replaces the older one on the phone
        out.push({ sub: s, occ: occ + "@" + lead, payload: { title: titleOf(m), body, tag: occ, url: BOARD + "#calendario" } });
      }
    }
  }
  return out;
}

/* the 7:00 summary: each device with `morning` on gets the day's meetings and events (all-day ones too), once a day */
export function morningSummaries(meetings: { id: string; data: Meeting }[], subs: Sub[], sent: Set<string>, now: number) {
  const local = new Date(now - UTC_OFFSET_HOURS * 3600000);
  const out: { sub: Sub; occ: string; payload: Record<string, unknown> }[] = [];
  if (local.getUTCHours() !== MORNING_HOUR) return out;
  const day = fmt(local), occ = "dia@" + day;
  // what happens today: a date of a meeting or series, or an event of several days that covers today
  const todays = meetings.map((r) => r.data || {}).filter((m) => live(m) && (datesBetween(m, day, day).length > 0
    || (!isSeries(m) && !!m.date && m.date < day && !!m.endDate && m.endDate >= day)));
  for (const s of subs) {
    if (!s.morning || sent.has(s.endpoint + " " + occ)) continue;
    const list = todays.filter((m) => forSub(s, m)).sort((a, b) => (hm(a.start) ? a.start! : "") < (hm(b.start) ? b.start! : "") ? -1 : 1);
    if (!list.length) continue;
    const meets = list.filter((m) => m.kind !== "event").length, evs = list.length - meets;
    const title = "Hoy: " + [meets ? meets + (meets === 1 ? " reunión" : " reuniones") : "", evs ? evs + (evs === 1 ? " evento" : " eventos") : ""].filter(Boolean).join(" y ");
    const lines = list.slice(0, 6).map((m) => (hm(m.start) ? m.start : "Todo el día") + " · " + titleOf(m));
    if (list.length > 6) lines.push("y " + (list.length - 6) + " más");
    out.push({ sub: s, occ, payload: { title, body: lines.join("\n"), tag: occ, url: BOARD + "#calendario" } });
  }
  return out;
}

async function rest(path: string, init: RequestInit = {}) {
  const r = await fetch(SB_URL + "/rest/v1/" + path, {
    ...init,
    headers: { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(path + ": " + r.status + " " + (await r.text()));
  return r.status === 204 || init.method === "DELETE" ? null : r.json();
}

/* sends one notification; false when the device is gone for good (the browser unsubscribed or the app was removed) */
// the first call creates the pair and keeps it in push_keys; every later call reads it back
async function vapid() {
  if (VAPID_PUBLIC && VAPID_PRIVATE) return;
  const read = async () => await rest("push_keys?select=public_key,private_key&id=eq.1") as { public_key: string; private_key: string }[];
  let rows = await read();
  if (!rows.length) {
    const k = webpush.generateVAPIDKeys();
    await rest("push_keys", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=minimal" }, body: JSON.stringify({ id: 1, public_key: k.publicKey, private_key: k.privateKey }) });
    rows = await read();
  }
  VAPID_PUBLIC = rows[0].public_key; VAPID_PRIVATE = rows[0].private_key;
}
async function send(s: Sub, payload: Record<string, unknown>): Promise<boolean> {
  await vapid();
  const d = webpush.generateRequestDetails({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), {
    vapidDetails: { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC, privateKey: VAPID_PRIVATE },
    TTL: 1800,
    urgency: "high",
  });
  const r = await fetch(d.endpoint, { method: d.method, headers: d.headers as Record<string, string>, body: d.body });
  await r.body?.cancel();
  if (r.status === 404 || r.status === 410) return false;
  if (!r.ok) console.warn("push", r.status, s.endpoint.slice(0, 40));
  return true;
}
async function forget(endpoint: string) {
  await rest("push_subs?endpoint=eq." + encodeURIComponent(endpoint), { method: "DELETE" });
}

if (import.meta.main) Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, "Content-Type": "application/json" } });
  let body: { test?: boolean; publicKey?: boolean; key?: string; endpoint?: string } = {};
  try { body = await req.json(); } catch { /* the job sends {} */ }

  // the page asks for the public half before subscribing a device
  if (body.publicKey) { await vapid(); return json({ publicKey: VAPID_PUBLIC }); }

  if (body.test) {
    const ck = await fetch(SB_URL + "/rest/v1/rpc/board_check", {
      method: "POST",
      headers: { apikey: ANON, Authorization: "Bearer " + ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ p_key: body.key || "" }),
    });
    if (!ck.ok || (await ck.json()) !== true) return json({ error: "clave" }, 403);
    const rows = await rest("push_subs?select=*&endpoint=eq." + encodeURIComponent(body.endpoint || "")) as Sub[];
    if (!rows.length) return json({ error: "sin-dispositivo" }, 404);
    const alive = await send(rows[0], { title: "Recordatorios activados", body: "Así se verán los avisos de tus reuniones en este dispositivo.", tag: "prueba", url: BOARD + "#calendario" });
    if (!alive) { await forget(rows[0].endpoint); return json({ error: "dispositivo-caducado" }, 410); }
    return json({ ok: true });
  }

  const subs = await rest("push_subs?select=*") as Sub[];
  if (!subs.length) return json({ sent: 0 });
  const now = Date.now();
  const meetings = await rest("meetings?select=id,data") as { id: string; data: Meeting }[];
  const since = new Date(now - 3 * 86400000).toISOString();
  const sentRows = await rest("push_sent?select=endpoint,occ&sent_at=gte." + since) as { endpoint: string; occ: string }[];
  const sent = new Set(sentRows.map((r) => r.endpoint + " " + r.occ));
  const due = morningSummaries(meetings, subs, sent, now).concat(dueReminders(meetings, subs, sent, now));
  const gone = new Set<string>();
  let n = 0;
  for (const d of due) {
    if (gone.has(d.sub.endpoint)) continue;
    // claim it first: if a slow run and the next one overlap, only the one that wrote the row sends it
    const won = await rest("push_sent", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify({ endpoint: d.sub.endpoint, occ: d.occ }) }) as unknown[];
    if (!won || !won.length) continue;
    if (await send(d.sub, d.payload)) n++; else { gone.add(d.sub.endpoint); await forget(d.sub.endpoint); }
  }
  if (new Date(now).getUTCMinutes() === 0) await rest("push_sent?sent_at=lt." + since, { method: "DELETE" });
  return json({ sent: n });
});
