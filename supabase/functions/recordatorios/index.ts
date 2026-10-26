// Meeting reminders on phones (web push) for the team board.
// A job in the database calls this every minute with an empty body: it looks at the meetings that start soon and sends each
// device that turned reminders on (table push_subs) one notification per meeting date, `lead_min` minutes before the start.
// The page calls it with { test: true, key, endpoint } to send a test notification to one device; that needs the team key.
import webpush from "npm:web-push@3.6.7";

const SB_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "https://jpchopite.github.io/tablero-colven/";
const BOARD = "https://jpchopite.github.io/tablero-colven/";
const UTC_OFFSET_HOURS = 4; // Venezuela is UTC-4 all year
const MODE: Record<string, string> = { presencial: "Presencial", video: "Videollamada", llamada: "Llamada" };
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info" };

type Rule = { freq?: string; interval?: number | string; weekdays?: number[]; monthMode?: string; monthDay?: number | string;
  monthDays?: number[]; nth?: number | string; weekday?: number | string; month?: number | string; startMonth?: number | string | null };
type Meeting = { title?: string; kind?: string; date?: string; start?: string; end?: string; mode?: string; place?: string;
  status?: string; team?: string[]; repeat?: Rule; until?: string; skip?: string[]; _deleted?: boolean };
type Sub = { endpoint: string; p256dh: string; auth: string; member_key: string; scope: string; lead_min: number };

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

/* everything that should go out now: one entry per device and meeting date */
export function dueReminders(meetings: { id: string; data: Meeting }[], subs: Sub[], sent: Set<string>, now: number) {
  const today = new Date(now - UTC_OFFSET_HOURS * 3600000);
  const lo = fmt(addDays(today, -1)), hi = fmt(addDays(today, 2));
  const out: { sub: Sub; occ: string; payload: Record<string, unknown> }[] = [];
  for (const row of meetings) {
    const m = row.data || {};
    if (m._deleted || m.kind === "note" || m.status === "cancelled" || m.status === "done") continue;
    const st = hm(m.start);
    if (!st) continue; // all-day events have no time to count back from
    const team = Array.isArray(m.team) ? m.team : [];
    for (const day of datesBetween(m, lo, hi)) {
      const at = startMs(day, st);
      if (now >= at) continue;
      const occ = row.id + "@" + day + "@" + m.start;
      for (const s of subs) {
        if (s.scope !== "all" && s.member_key && team.length && !team.includes(s.member_key)) continue;
        if (now < at - s.lead_min * 60000 || sent.has(s.endpoint + " " + occ)) continue;
        const en = hm(m.end);
        const where = m.mode === "video" ? "Videollamada" : m.place || (m.mode && m.mode !== "presencial" ? MODE[m.mode] : "");
        const body = [inText(Math.round((at - now) / 60000)), m.start + (en ? " a " + m.end : ""), where].filter(Boolean).join(" · ");
        out.push({ sub: s, occ, payload: { title: m.title || (m.kind === "event" ? "Evento" : "Reunión"), body, tag: occ, url: BOARD + "#calendario" } });
      }
    }
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
async function send(s: Sub, payload: Record<string, unknown>): Promise<boolean> {
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
  let body: { test?: boolean; key?: string; endpoint?: string } = {};
  try { body = await req.json(); } catch { /* the job sends {} */ }

  if (body.test) {
    const ck = await fetch(SB_URL + "/rest/v1/rpc/board_check", {
      method: "POST",
      headers: { apikey: ANON, Authorization: "Bearer " + ANON, "Content-Type": "application/json" },
      body: JSON.stringify({ p_key: body.key || "" }),
    });
    if (!ck.ok || (await ck.json()) !== true) return json({ error: "clave" }, 403);
    const rows = await rest("push_subs?select=*&endpoint=eq." + encodeURIComponent(body.endpoint || "")) as Sub[];
    if (!rows.length) return json({ error: "sin-dispositivo" }, 404);
    const alive = await send(rows[0], { title: "Recordatorios activados", body: "Así se verá el aviso de cada reunión, " + rows[0].lead_min + " min antes.", tag: "prueba", url: BOARD + "#calendario" });
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
  const due = dueReminders(meetings, subs, sent, now);
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
