// Tareas repetidas: al completar una, se crea la siguiente para más adelante.
// La próxima no aparece en el plan hasta su fecha (usa notBefore).

import { addDays, startOfDay, ymd, parseYMD } from "./time.js";

export const REPEAT_LABEL = {
  day: "todos los días",
  week: "cada semana",
  "2weeks": "cada 2 semanas",
  month: "cada mes",
};

/** Suma meses sin desbordar (31 de enero + 1 mes = 28/29 de febrero). */
export function addMonths(date, n) {
  const target = new Date(date.getFullYear(), date.getMonth() + n, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay));
}

function advance(date, repeat) {
  switch (repeat) {
    case "day": return addDays(date, 1);
    case "week": return addDays(date, 7);
    case "2weeks": return addDays(date, 14);
    case "month": return addMonths(date, 1);
    default: return null;
  }
}

const MONDAY_FIRST = [1, 2, 3, 4, 5, 6, 0];

/** Primer día permitido ("days") después de la fecha dada. */
function nextAllowedDay(date, days) {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(date, i);
    if (days.includes(d.getDay())) return d;
  }
  return null;
}

/**
 * Con días elegidos (ej: sábados): "todos los días" avanza al siguiente día permitido y las
 * repeticiones por semana saltan a la semana que corresponde (lunes a domingo), en el primer día permitido.
 */
function advanceOnDays(done, repeat, days) {
  if (repeat === "day") return nextAllowedDay(done, days);
  if (repeat === "week" || repeat === "2weeks") {
    const monday = addDays(done, -((done.getDay() + 6) % 7));
    const first = MONDAY_FIRST.find((d) => days.includes(d));
    if (first === undefined) return null;
    return addDays(monday, (repeat === "week" ? 7 : 14) + MONDAY_FIRST.indexOf(first));
  }
  return null;
}

/**
 * Datos para la próxima ocurrencia de una tarea repetida que se acaba de completar.
 * @returns {object|null} campos a pisar en la copia, o null si la tarea no se repite
 */
export function nextOccurrence(task, doneAt) {
  if (!task.repeat) return null;
  const done = startOfDay(doneAt);
  const next = (task.days?.length ? advanceOnDays(done, task.repeat, task.days) : null) ?? advance(done, task.repeat);
  if (!next) return null;

  let due = null;
  if (task.due) {
    // Mantiene el ritmo original; si ya quedó atrás, usa la nueva fecha.
    let d = advance(parseYMD(task.due), task.repeat);
    while (d && d < next) d = advance(d, task.repeat);
    due = ymd(d && d > next ? d : next);
  }
  return {
    status: "todo",
    doneAt: null,
    notBefore: next.toISOString(),
    pin: null,
    doneMinutes: 0,
    due,
    subtasks: (task.subtasks ?? []).map((s) => ({ ...s, done: false })),
  };
}
