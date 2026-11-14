// Puntos, racha y nivel. Todo se calcula desde las tareas hechas: no hay nada extra que guardar.
//
// Un día cumple si se completó al menos una tarea. Cada semana (lunes a domingo) hay días de
// descanso: un día sin tareas que no corta la racha ni la suma. La racha nunca castiga hoy:
// mientras el día no terminó, "pendiente" no es "fallado".

import { addDays, startOfDay, ymd } from "./time.js";

export const EFFORT_FACTOR = { light: 1, medium: 1.25, hard: 1.5 };

/** Puntos de una tarea: sus minutos, un poco más si exige más. Mínimo 5, máximo 100. */
export function pointsFor(task) {
  const raw = (task.minutes ?? 30) * (EFFORT_FACTOR[task.effort] ?? 1.25);
  return Math.max(5, Math.min(100, Math.round(raw / 5) * 5));
}

/** Extra por día cumplido: crece con la racha hasta un tope. */
export const dayBonus = (run) => 5 + Math.min(run, 10);

const LEVEL_AT = [0, 60, 150, 280, 450, 700, 1000, 1400, 1900, 2500];

/** Nivel según puntos totales, con el avance hacia el siguiente. */
export function levelFor(points) {
  let level = 1;
  const at = (n) => (n <= LEVEL_AT.length ? LEVEL_AT[n - 1] : LEVEL_AT[LEVEL_AT.length - 1] + (n - LEVEL_AT.length) * 700);
  while (points >= at(level + 1)) level += 1;
  const from = at(level);
  const to = at(level + 1);
  return { level, from, to, into: points - from, pct: Math.round(((points - from) / (to - from)) * 100) };
}

/** Accesorios que desbloquea la mejor racha. */
export const ACCESSORIES = [
  { id: "bow", at: 3, label: "Moñito" },
  { id: "scarf", at: 7, label: "Bufanda" },
  { id: "hat", at: 14, label: "Gorrito" },
  { id: "crown", at: 30, label: "Corona" },
];

export function outfit(best) {
  const has = (id) => best >= ACCESSORIES.find((a) => a.id === id).at;
  const crown = has("crown");
  return { bow: has("bow"), scarf: has("scarf"), hat: has("hat") && !crown, crown };
}

export const nextAccessory = (best) => ACCESSORIES.find((a) => a.at > best) ?? null;

const weekKey = (d) => ymd(addDays(d, -((d.getDay() + 6) % 7)));

/**
 * @param {object[]} tasks
 * @param {Date} now
 * @param {{rest?: number}} [opts] días de descanso por semana (0 = estricto)
 */
export function streakStats(tasks, now, { rest = 1 } = {}) {
  const byDay = new Map();
  let taskPoints = 0;
  for (const t of tasks) {
    // Los bloques terminados de una tarea larga cuentan el día en que se hicieron.
    const partials = t.partials ?? [];
    for (const p of partials) {
      const key = ymd(new Date(p.at));
      byDay.set(key, (byDay.get(key) ?? 0) + 1);
      taskPoints += pointsFor({ minutes: p.minutes, effort: t.effort });
    }
    if (t.status !== "done" || !t.doneAt) continue;
    const key = ymd(new Date(t.doneAt));
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
    const rest = (t.minutes ?? 30) - partials.reduce((a, p) => a + p.minutes, 0);
    taskPoints += pointsFor(partials.length ? { ...t, minutes: rest } : t);
  }

  const today = startOfDay(now);
  const state = new Map();
  let run = 0;
  let best = 0;
  let bonus = 0;
  const restUsed = new Map();

  if (byDay.size) {
    const first = [...byDay.keys()].sort()[0];
    const [y, m, d] = first.split("-").map(Number);
    for (let day = new Date(y, m - 1, d); day < today; day = addDays(day, 1)) {
      const key = ymd(day);
      if (byDay.has(key)) {
        run += 1;
        best = Math.max(best, run);
        bonus += dayBonus(run);
        state.set(key, "done");
        continue;
      }
      const wk = weekKey(day);
      if ((restUsed.get(wk) ?? 0) < rest) {
        restUsed.set(wk, (restUsed.get(wk) ?? 0) + 1);
        state.set(key, "rest");
      } else {
        run = 0;
        state.set(key, "miss");
      }
    }
    if (byDay.has(ymd(today))) {
      run += 1;
      best = Math.max(best, run);
      bonus += dayBonus(run);
    }
  }

  const todayKey = ymd(today);
  const todayDone = byDay.has(todayKey);
  state.set(todayKey, todayDone ? "done" : "today");

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const date = ymd(addDays(today, i - 6));
    return { date, state: state.get(date) ?? "none" };
  });

  const total = taskPoints + bonus;
  return {
    current: run,
    best,
    todayDone,
    total,
    level: levelFor(total),
    last7,
    restLeft: Math.max(0, rest - (restUsed.get(weekKey(today)) ?? 0)),
  };
}
