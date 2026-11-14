// Estado de la app y acciones. La vista solo lee de acá y llama a estas funciones.

import { createStore } from "../store/storage.js";
import { plan } from "../engine/planner.js";
import { effectiveProfile } from "../engine/learn.js";
import { addDays, startOfDay, ceilTo, minutesOfDay, parseHM } from "../engine/time.js";
import { nextOccurrence } from "../engine/repeat.js";
import { estimate, actualFrom } from "../engine/estimate.js";
import { syncRoutine, patchRoutineTasks } from "../store/routine.js";
import { streakStats, ACCESSORIES } from "../engine/streak.js";

export const app = {
  store: null,
  profile: null,
  tasks: [],
  checkins: [],
  tab: "ahora",
  now: new Date(),
  onboarding: false,
  checkinSnoozedUntil: 0,
  cheer: null, // { until: ms, points, id } reacción de la mascota al completar
  askDuration: null, // id de la tarea recién completada sobre la que preguntamos cuánto tardó
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
  applyRoutine();
}

/** Mantiene las tareas de la rutina diaria al día (crea, actualiza o saca lo que corresponda). */
function applyRoutine() {
  if (!app.profile || app.onboarding) return;
  const r = syncRoutine(app.profile.routine, app.tasks, app.now, uid);
  if (r.changed) {
    app.tasks = r.tasks;
    app.store.saveTasks(app.tasks);
  }
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

/** Perfil con la curva efectiva (declarada + aprendida), para dibujar y planificar. */
export const effective = () => effectiveProfile(app.profile, app.checkins, app.now);

export function getPlan() {
  const key = `${version}|${Math.floor(app.now.getTime() / 60000)}`;
  if (cache?.key !== key) {
    // El plan usa la curva aprendida (lo declarado + lo que dicen los check-ins).
    const profile = effective();
    cache = { key, value: plan(profile, app.tasks, app.now, { days: 7, checkin: activeCheckin() }) };
  }
  return cache.value;
}

/** Racha, puntos y nivel, calculados desde las tareas hechas (memoizado igual que el plan). */
let statsCache = null;
export function stats() {
  const key = `${version}|${Math.floor(app.now.getTime() / 60000)}`;
  if (statsCache?.key !== key) statsCache = { key, value: streakStats(app.tasks, app.now, { rest: app.profile.streakRest ?? 1 }) };
  return statsCache.value;
}

let cheerTimer = null;
function cheer(before, after, id) {
  app.cheer = {
    id,
    points: after.total - before.total,
    streak: after.current,
    newDay: !before.todayDone,
    levelUp: after.level.level > before.level.level,
    accessory: ACCESSORIES.find((a) => before.best < a.at && after.best >= a.at) ?? null,
  };
  clearTimeout(cheerTimer);
  cheerTimer = setTimeout(() => {
    app.cheer = null;
    emit();
  }, 6000);
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
  // Si no indicó duración o esfuerzo, estimamos según la tarea y lo que ya cargó antes.
  const est = estimate(data.title, app.tasks);
  app.tasks.push({
    id: uid(),
    title: data.title,
    minutes: data.minutes ?? est.minutes,
    minutesAuto: data.minutes == null,
    effortAuto: data.effort == null,
    due: data.due ?? null,
    priority: data.priority ?? 2,
    effort: data.effort ?? est.effort,
    repeat: data.repeat ?? null,
    subtasks: data.subtasks ?? [],
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

/** Completa la tarea. Si se repite, deja lista la siguiente para su fecha. */
export function completeTask(id) {
  const t = app.tasks.find((x) => x.id === id);
  if (!t) return;
  const before = stats();
  t.status = "done";
  t.doneAt = app.now.toISOString();
  app.askDuration = id;
  const patch = nextOccurrence(t, app.now);
  if (patch) {
    const next = { ...t, ...patch, id: uid(), createdAt: app.now.toISOString() };
    delete next.nextId;
    t.nextId = next.id;
    app.tasks.push(next);
  }
  version += 1; // invalida el cálculo de racha antes de comparar
  cheer(before, stats(), id);
  saveTasks();
}

export function undoTask(id) {
  const t = app.tasks.find((x) => x.id === id);
  if (!t) return;
  // Si al completarla se creó la siguiente repetición y sigue intacta, la sacamos.
  if (t.nextId) app.tasks = app.tasks.filter((x) => !(x.id === t.nextId && x.status === "todo"));
  t.status = "todo";
  t.doneAt = null;
  delete t.nextId;
  delete t.actualMinutes;
  if (app.askDuration === id) app.askDuration = null;
  if (app.cheer?.id === id) app.cheer = null;
  saveTasks();
}

/** "¿Cuánto tardó?": menos / previsto / mas. Alimenta las estimaciones futuras. */
export function answerDuration(id, answer) {
  const t = app.tasks.find((x) => x.id === id);
  app.askDuration = null;
  if (t) t.actualMinutes = actualFrom(t.minutes, answer);
  saveTasks();
}

export function dismissDuration() {
  app.askDuration = null;
  emit();
}

export function toggleSubtask(taskId, subId) {
  const t = app.tasks.find((x) => x.id === taskId);
  const s = t?.subtasks?.find((x) => x.id === subId);
  if (s) s.done = !s.done;
  saveTasks();
}

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

/** Guarda cambios de un ítem de rutina y los pasa a su tarea pendiente. */
export function updateRoutineItem(item) {
  const i = app.profile.routine.findIndex((r) => r.id === item.id);
  if (i < 0) return;
  app.profile.routine[i] = item;
  patchRoutineTasks(item, app.tasks);
  app.store.saveTasks(app.tasks);
  saveProfile(app.profile);
}

export function saveProfile(profile) {
  app.store.saveProfile(profile);
  app.profile = profile;
  applyRoutine();
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
  applyRoutine();
  emit();
}
