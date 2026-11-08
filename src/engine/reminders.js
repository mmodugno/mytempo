// Recordatorios: de un plan, saca los avisos "tu próxima tarea arranca en unos minutos".
// Funciones puras; quien las usa (la UI) decide cómo mostrar el aviso.

import { parseYMD } from "./time.js";

export const DEFAULT_LEAD_MIN = 5;

function startDate(dayStr, minutes) {
  const d = parseYMD(dayStr);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, minutes);
}

/**
 * Todos los avisos del plan que todavía no pasaron, ordenados por hora.
 * @param {{days: Array}} plan
 * @param {Date} now
 * @param {{ lead?: number, withinMin?: number }} [opts] lead: minutos de anticipación; withinMin: cuánto adelante mirar
 */
export function upcomingReminders(plan, now, { lead = DEFAULT_LEAD_MIN, withinMin = 24 * 60 } = {}) {
  const out = [];
  for (const day of plan.days) {
    for (const it of day.items) {
      if (it.type !== "task") continue;
      const startsAt = startDate(day.date, it.start);
      if (startsAt <= now) continue;
      if (startsAt - now > withinMin * 60000) continue;
      out.push({
        key: `${day.date}|${it.taskId}|${it.part}|${it.start}`,
        at: new Date(startsAt.getTime() - lead * 60000),
        startsAt,
        taskId: it.taskId,
        title: it.title,
        minutes: it.end - it.start,
        effort: it.effort,
        part: it.part,
        total: it.total,
      });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * Avisos que ya tocaba mostrar y no se mostraron (por ejemplo, si el teléfono tenía la app dormida).
 * Solo cuenta los de los últimos `graceMin` minutos que todavía no empezaron.
 */
export function dueReminders(plan, now, fired = new Set(), { lead = DEFAULT_LEAD_MIN, graceMin = 10 } = {}) {
  return upcomingReminders(plan, new Date(now.getTime() - graceMin * 60000), { lead, withinMin: 24 * 60 })
    .filter((r) => r.at <= now && r.startsAt > now && !fired.has(r.key));
}
