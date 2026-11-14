// Recordatorios: programa un aviso antes de cada tarea mientras la app esté abierta o en segundo plano.
// Para avisar con la app cerrada hace falta un servidor de push o la versión Android; esta es la parte web.

import { getPlan } from "./state.js";
import { upcomingReminders, dueReminders, toNative, DEFAULT_LEAD_MIN } from "../engine/reminders.js";
import { dur, hm, EFFORT_LABEL } from "./dom.js";
import { toast } from "./components.js";

const SETTINGS_KEY = "mytempo.notify";
const FIRED_KEY = "mytempo.fired";

// En la app de Android (Capacitor) los avisos los programa el sistema y llegan con la app cerrada.
// En la web se usan las notificaciones del navegador mientras la app está abierta o en segundo plano.
const native = () => globalThis.Capacitor?.Plugins?.LocalNotifications ?? null;
export const supported = () => Boolean(native()) || typeof Notification !== "undefined";

export function getSettings() {
  try {
    return { on: false, lead: DEFAULT_LEAD_MIN, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") };
  } catch {
    return { on: false, lead: DEFAULT_LEAD_MIN };
  }
}

export function saveSettings(s) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  reschedule();
}

/** Pide permiso (tiene que venir de un toque de la persona) y activa los recordatorios. */
export async function enable() {
  if (!supported()) return "unsupported";
  if (native()) {
    const r = await native().requestPermissions();
    if (r.display === "granted") saveSettings({ ...getSettings(), on: true });
    return r.display;
  }
  let perm = Notification.permission;
  if (perm === "default") perm = await Notification.requestPermission();
  if (perm === "granted") saveSettings({ ...getSettings(), on: true });
  return perm;
}

export function disable() {
  saveSettings({ ...getSettings(), on: false });
}

/* ---------- Programación ---------- */

const fired = new Set(JSON.parse(localStorage.getItem(FIRED_KEY) ?? "[]"));
let timers = [];

function remember(key) {
  fired.add(key);
  localStorage.setItem(FIRED_KEY, JSON.stringify([...fired].slice(-200)));
}

const describe = (lead) => (r) => {
  const mins = Math.max(1, Math.round((r.startsAt - r.at) / 60000));
  const startMin = r.startsAt.getHours() * 60 + r.startsAt.getMinutes();
  return { title: `En ${Math.min(mins, lead)} min: ${r.title}`, body: `Empieza a las ${hm(startMin)} · ${dur(r.minutes)} · ${EFFORT_LABEL[r.effort]}` };
};

async function rescheduleNative(s) {
  const ln = native();
  const pending = await ln.getPending();
  if (pending.notifications.length) await ln.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  if (!s.on) return;
  const list = upcomingReminders(getPlan(), new Date(), { lead: s.lead, withinMin: 7 * 24 * 60 });
  if (list.length) await ln.schedule({ notifications: toNative(list, describe(s.lead)) });
}

export function reschedule() {
  timers.forEach(clearTimeout);
  timers = [];
  const s = getSettings();
  if (native()) return void rescheduleNative(s).catch(() => {});
  if (!s.on || !supported()) return;
  const now = new Date();
  const plan = getPlan();

  // Avisos que tocaban mientras la app estaba dormida
  for (const r of dueReminders(plan, now, fired, { lead: s.lead })) fire(r, s.lead);

  for (const r of upcomingReminders(plan, now, { lead: s.lead, withinMin: 12 * 60 })) {
    const ms = r.at - now;
    if (ms <= 0 || fired.has(r.key)) continue;
    timers.push(setTimeout(() => fire(r, s.lead), Math.min(ms, 2 ** 31 - 1)));
  }
}

async function fire(r, lead) {
  if (fired.has(r.key)) return;
  remember(r.key);
  const mins = Math.max(1, Math.round((r.startsAt - new Date()) / 60000));
  const title = `En ${Math.min(mins, lead)} min: ${r.title}`;
  const startMin = r.startsAt.getHours() * 60 + r.startsAt.getMinutes();
  const body = `Empieza a las ${hm(startMin)} · ${dur(r.minutes)} · ${EFFORT_LABEL[r.effort]}`;
  await show(title, body, r.key);
}

async function show(title, body, tag) {
  if (native()) return void (await native().schedule({ notifications: [{ id: 1, title, body, schedule: { at: new Date(Date.now() + 1500) } }] }));
  if (supported() && Notification.permission === "granted") {
    try {
      const reg = await navigator.serviceWorker?.ready;
      if (reg) return void (await reg.showNotification(title, { body, tag, icon: "icons/icon-192.png", badge: "icons/icon-192.png" }));
      return void new Notification(title, { body, tag });
    } catch {
      /* si falla, avisamos adentro de la app */
    }
  }
  toast(`${title}. ${body}`);
}

export const testNotification = () => show("mytempo funciona", "Así te voy a avisar antes de cada tarea.", "test");
