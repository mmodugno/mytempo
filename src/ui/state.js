// Estado de la app y acciones. La vista solo lee de acá y llama a estas funciones.

import { createStore } from "../store/storage.js";
import { plan } from "../engine/planner.js";
import { effectiveProfile } from "../engine/learn.js";
import { addDays, startOfDay, ceilTo, minutesOfDay, parseHM } from "../engine/time.js";

export const app = {
  store: null,
  profile: null,
  tasks: [],
  checkins: [],
  tab: "ahora",
  now: new Date(),
  onboarding: false,
  checkinSnoozedUntil: 0,
};

const listeners = new Set();
let version = 0;
let cache = null;

export const subscribe = (fn) => listeners.add(fn);
export function emit() {
  version += 1;
  listeners.forEach((fn) => fn());
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function init(backend) {
  app.store = createStore(backend);
  app.profile = app.store.getProfile();
  app.tasks = app.store.getTasks();
  app.checkins = app.store.getCheckins();
  app.onboarding = !app.store.hasProfile();
}

export function tick() {
  app.now = new Date();
}

/** Último check-in si es de hoy y de las últimas 3 horas (el motor lo usa para ajustar el plan). */
export function activeCheckin() {
  const last = app.checkins[app.checkins.length - 1];
  if (!last) return null;
  const at = new Date(last.at);
  const ageMin = (app.now - at) / 60000;
  if (ageMin < 0 || ageMin > 180) return null;
  if (startOfDay(at).getTime() !== startOfDay(app.now).getTime()) return null;
  return { energy: last.energy, at };
}

export function getPlan() {
  const key = `${version}|${Math.floor(app.now.getTime() / 60000)}`;
  if (cache?.key !== key) {
    // El plan usa la curva aprendida (lo declarado + lo que dicen los check-ins).
    const profile = effectiveProfile(app.profile, app.checkins, app.now);
    cache = { key, value: plan(profile, app.tasks, app.now, { days: 7, checkin: activeCheckin() }) };
  }
  return cache.value;
}

/** ¿Es momento de preguntar cómo se siente? Cada ~4 h, solo mientras está despierta. */
export function checkinDue() {
  if (app.now.getTime() < app.checkinSnoozedUntil) return false;
  const nowMin = minutesOfDay(app.now);
  const wake = parseHM(app.profile.wake);
  let sleep = parseHM(app.profile.sleep);
  if (sleep <= wake) sleep += 1440;
  const awake = (nowMin >= wake && nowMin < sleep) || nowMin < sleep - 1440;
  if (!awake) return false;
  const last = app.checkins[app.checkins.length - 1];
  if (!last) return true;
  return (app.now - new Date(last.at)) / 3600000 >= 4;
}

/* ---------- Acciones ---------- */

function saveTasks() {
  app.store.saveTasks(app.tasks);
  emit();
}

export function addTask(data) {
  app.tasks.push({
    id: uid(),
    title: data.title,
    minutes: data.minutes ?? 30,
    due: data.due ?? null,
    priority: data.priority ?? 2,
    effort: data.effort ?? "medium",
    status: "todo",
    createdAt: app.now.toISOString(),
  });
  saveTasks();
}

export function updateTask(id, patch) {
  const t = app.tasks.find((x) => x.id === id);
  if (t) Object.assign(t, patch);
  saveTasks();
}

export function removeTask(id) {
  app.tasks = app.tasks.filter((t) => t.id !== id);
  saveTasks();
}

export const completeTask = (id) => updateTask(id, { status: "done", doneAt: app.now.toISOString() });
export const undoTask = (id) => updateTask(id, { status: "todo", doneAt: null });

/** "Más tarde": la tarea no se vuelve a ofrecer en la próxima hora y media. */
export function snoozeTask(id) {
  const later = new Date(app.now.getTime() + 90 * 60000);
  later.setMinutes(ceilTo(later.getMinutes(), 15), 0, 0);
  updateTask(id, { notBefore: later.toISOString() });
}

/** "No hoy": pasa a mañana. Sin culpa, el plan se acomoda solo. */
export function skipToday(id) {
  updateTask(id, { notBefore: addDays(startOfDay(app.now), 1).toISOString() });
}

export function saveProfile(profile) {
  app.store.saveProfile(profile);
  app.profile = profile;
  emit();
}

export function addCheckin(energy, focus = null) {
  app.store.addCheckin({ energy, focus, at: app.now });
  app.checkins = app.store.getCheckins();
  emit();
}

export function setFocusOnLastCheckin(focus) {
  app.store.setLastCheckinFocus(focus);
  app.checkins = app.store.getCheckins();
  emit();
}

export function snoozeCheckin(hours = 1) {
  app.checkinSnoozedUntil = app.now.getTime() + hours * 3600000;
  emit();
}

export function reload() {
  app.profile = app.store.getProfile();
  app.tasks = app.store.getTasks();
  app.checkins = app.store.getCheckins();
  app.onboarding = !app.store.hasProfile();
  emit();
}
