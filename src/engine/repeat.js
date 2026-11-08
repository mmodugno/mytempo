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

/**
 * Datos para la próxima ocurrencia de una tarea repetida que se acaba de completar.
 * @returns {object|null} campos a pisar en la copia, o null si la tarea no se repite
 */
export function nextOccurrence(task, doneAt) {
  if (!task.repeat) return null;
  const done = startOfDay(doneAt);
  const next = advance(done, task.repeat);
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
    due,
    subtasks: (task.subtasks ?? []).map((s) => ({ ...s, done: false })),
  };
}
