// Motor del plan: función pura. Dado un perfil, tareas y "ahora", devuelve el plan.
// Replanificar es simplemente volver a llamarla con las tareas actualizadas.

import {
  parseHM,
  ymd,
  parseYMD,
  addDays,
  startOfDay,
  minutesOfDay,
  isWeekend,
  ceilTo,
  diffDays,
} from "./time.js";
import { avgEnergy } from "./energy.js";

export const GRID = 15; // los bloques arrancan en múltiplos de 15 min
export const MAX_CHUNK = 90; // una tarea más larga se parte en bloques de foco de hasta 90 min
export const DEFAULT_MINUTES = 30;
export const MIN_TASK = 5; // una tarea corta (ej: lavar los platos, 8 min) no se infla a 15
export const DAY_PENALTY = 0.15; // preferencia leve por hacer las cosas más temprano

/** A qué nivel de energía apunta cada tipo de esfuerzo. */
const TARGET = { hard: 5, medium: 3.5, light: 1.5 };
/** Momentos del día para las tareas con preferencia horaria (minutos desde medianoche). */
export const PARTS = { morning: [300, 780], afternoon: [780, 1140], evening: [1140, 1440] };
const PART_PENALTY = 4; // casi una regla, pero si no entra en ese momento no se pierde la tarea
const EFFORT_RANK = { hard: 3, medium: 2, light: 1 };

/**
 * @param {object} profile  Perfil de la persona (horarios, energía, preferencias)
 * @param {Array}  tasks    Tareas { id, title, minutes?, due?, priority?, effort?, status?, notBefore? }
 * @param {Date}   now      Momento actual
 * @param {object} [opts]   { days = 7, checkin = { energy, at } }
 * @returns {{ days: Array, unplaced: Array }}
 */
export function plan(profile, tasks, now, opts = {}) {
  const horizon = opts.days ?? 7;
  const checkin = opts.checkin ?? null;
  const today = startOfDay(now);

  const days = [];
  for (let i = 0; i < horizon; i++) days.push(buildDay(profile, addDays(today, i), now, i === 0));

  // Lo que arranca después del horizonte (ej: la próxima tarea repetida) no cuenta como "sin lugar".
  const horizonEnd = addDays(today, horizon);
  const todo = tasks.filter((t) => (t.status ?? "todo") === "todo");
  const later = todo.filter((t) => t.notBefore && new Date(t.notBefore) >= horizonEnd).map((t) => ({ taskId: t.id, title: t.title, notBefore: t.notBefore }));
  const pending = todo.filter((t) => !later.some((l) => l.taskId === t.id));
  const chunks = pending.flatMap(toChunks).sort(byUrgency(today));
  const unplaced = [];
  const unplacedSeen = new Set();

  for (const chunk of chunks) {
    const placed = placeChunk(profile, days, chunk, today, now, checkin);
    if (!placed && !unplacedSeen.has(chunk.task.id)) {
      unplacedSeen.add(chunk.task.id);
      unplaced.push({
        taskId: chunk.task.id,
        title: chunk.task.title,
        reason: chunk.task.due ? "no-room-before-due" : "no-room",
      });
    }
  }

  return {
    generatedAt: now.toISOString(),
    days: days.map(finishDay),
    unplaced,
    later,
  };
}

/* ---------- Armado de cada día ---------- */

function buildDay(profile, date, now, isToday) {
  const dow = date.getDay();
  const dateStr = ymd(date);
  const wake = parseHM(profile.wake);
  let sleep = parseHM(profile.sleep);
  if (sleep <= wake) sleep += 1440; // se acuesta pasada la medianoche

  const occupied = [];
  for (const b of profile.fixedBlocks ?? []) {
    if (!b.days.includes(dow)) continue;
    occupied.push({
      type: "fixed",
      kind: b.kind ?? "commitment",
      title: b.title,
      start: parseHM(b.start),
      end: parseHM(b.end),
    });
  }
  for (const b of profile.oneOffBlocks ?? []) {
    if (b.date !== dateStr) continue;
    occupied.push({
      type: "fixed",
      oneOffId: b.id ?? null,
      kind: b.kind ?? "commitment",
      title: b.title,
      start: parseHM(b.start),
      end: parseHM(b.end),
    });
  }

  // Lo que ya pasó hoy no se puede usar.
  let from = wake;
  if (isToday) from = Math.max(from, ceilTo(minutesOfDay(now), GRID));

  const budgetCfg = isWeekend(date) ? profile.freeMinutes?.weekend : profile.freeMinutes?.weekday;
  return {
    date,
    dateStr,
    dow,
    wake,
    sleep,
    from,
    occupied,
    freeMinutes: budgetCfg ?? 120,
    placedMinutes: 0,
    budget: null, // se calcula al primer uso
  };
}

/** Ventanas libres [start, end) del día, descontando bloques ocupados. */
function freeWindows(day) {
  const busy = day.occupied
    .map((o) => [o.start, o.end])
    .sort((a, b) => a[0] - b[0]);
  const windows = [];
  let cursor = day.from;
  for (const [s, e] of busy) {
    if (e <= cursor) continue;
    if (s > cursor) windows.push([cursor, Math.min(s, day.sleep)]);
    cursor = Math.max(cursor, e);
    if (cursor >= day.sleep) break;
  }
  if (cursor < day.sleep) windows.push([cursor, day.sleep]);
  return windows.filter(([s, e]) => e - s >= GRID);
}

/** Cuántos minutos de tareas admite el día, dejando libre el tiempo libre pedido. */
function dayBudget(day) {
  if (day.budget === null) {
    const total = freeWindows(day).reduce((acc, [s, e]) => acc + (e - s), 0);
    day.budget = Math.max(0, total - day.freeMinutes);
  }
  return day.budget;
}

/* ---------- Tareas y orden de colocación ---------- */

function toChunks(task) {
  const minutes = Math.max(MIN_TASK, task.minutes ?? DEFAULT_MINUTES);
  const n = Math.ceil(minutes / MAX_CHUNK);
  const base = Math.floor(minutes / n / 5) * 5; // minutos por parte, múltiplos de 5
  const out = [];
  let left = minutes;
  for (let i = 0; i < n; i++) {
    const m = i === n - 1 ? left : base;
    left -= m;
    out.push({ task, minutes: m, part: i + 1, total: n });
  }
  return out;
}

function dueOf(task, today) {
  if (!task.due) return null;
  const d = parseYMD(task.due);
  return d < today ? today : d; // lo vencido se trata como "para hoy"
}

/** Primero lo que vence antes, después lo más prioritario, y entre iguales lo más exigente. */
function byUrgency(today) {
  return (a, b) => {
    const da = dueOf(a.task, today);
    const db = dueOf(b.task, today);
    if (da && db && da.getTime() !== db.getTime()) return da - db;
    if (da && !db) return -1;
    if (!da && db) return 1;
    const pa = a.task.priority ?? 2;
    const pb = b.task.priority ?? 2;
    if (pa !== pb) return pb - pa;
    const ea = EFFORT_RANK[a.task.effort ?? "medium"];
    const eb = EFFORT_RANK[b.task.effort ?? "medium"];
    if (ea !== eb) return eb - ea;
    return a.part - b.part;
  };
}

/* ---------- Colocación ---------- */

function placeChunk(profile, days, chunk, today, now, checkin) {
  const { task, minutes } = chunk;
  const due = dueOf(task, today);
  const target = TARGET[task.effort ?? "medium"];
  const notBefore = task.notBefore ? new Date(task.notBefore) : null;
  const breakMin = profile.breakMinutes ?? 10;

  let best = null;
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    if (due && day.date > due) break;
    if (task.days?.length && !task.days.includes(day.date.getDay())) continue; // solo ciertos días de la semana
    if (notBefore && addDays(day.date, 1) <= notBefore) continue; // todo el día queda antes del "no antes de"
    const isDueDay = due && day.date.getTime() === due.getTime();
    const budget = dayBudget(day);
    // El día de vencimiento se permite pasar el presupuesto: la fecha límite manda.
    if (!isDueDay && day.placedMinutes + minutes > budget) continue;

    for (const [ws, we] of freeWindows(day)) {
      let start = ceilTo(ws, GRID);
      if (notBefore && sameDay(notBefore, day.date)) {
        start = Math.max(start, ceilTo(minutesOfDay(notBefore), GRID));
      }
      for (; start + minutes <= we; start += GRID) {
        const e = avgEnergy(profile, day.date, start, start + minutes, checkin);
        const dayIdx = diffDays(today, day.date);
        const [ps, pe] = PARTS[task.part] ?? [0, 1440];
        const outside = start < ps || start >= pe ? PART_PENALTY : 0;
        const score = Math.abs(e - target) + dayIdx * DAY_PENALTY + outside;
        if (!best || score < best.score) best = { score, day, start };
      }
    }
  }
  if (!best) return false;

  const { day, start } = best;
  day.occupied.push({
    type: "task",
    taskId: task.id,
    title: task.title,
    effort: task.effort ?? "medium",
    part: chunk.part,
    total: chunk.total,
    start,
    end: start + minutes,
  });
  // Pausa corta después de cada bloque, si hay lugar antes de lo siguiente.
  if (breakMin > 0) {
    const nextBusy = day.occupied
      .filter((o) => o.start >= start + minutes)
      .map((o) => o.start)
      .sort((a, b) => a - b)[0];
    const limit = Math.min(nextBusy ?? day.sleep, day.sleep);
    const bEnd = Math.min(start + minutes + breakMin, limit);
    if (bEnd - (start + minutes) >= 5) {
      day.occupied.push({ type: "break", title: "Pausa", start: start + minutes, end: bEnd });
    }
  }
  day.placedMinutes += minutes;
  return true;
}

function sameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  );
}

/* ---------- Salida ---------- */

function finishDay(day) {
  const items = [...day.occupied].sort((a, b) => a.start - b.start);
  return {
    date: day.dateStr,
    dow: day.dow,
    items,
    freeMinutes: freeWindows({ ...day, occupied: day.occupied }).reduce((acc, [s, e]) => acc + (e - s), 0),
  };
}
