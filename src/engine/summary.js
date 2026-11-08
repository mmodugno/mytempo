// Resumen semanal: qué se logró, cuándo rinde mejor la persona y qué ajustes sugiere la app.
// Función pura. El tono es siempre amable: sin reproches.

import { addDays, startOfDay, ymd, parseHM, diffDays } from "./time.js";
import { learnCurve } from "./learn.js";

export const MIN_CHECKINS_FOR_INSIGHTS = 5;

/** Mejor ventana de 2 horas dentro del horario despierta, para una curva de 24 valores. */
export function bestWindow(curve, wakeMin, sleepMin) {
  const first = Math.floor(wakeMin / 60);
  const last = Math.ceil(sleepMin / 60) - 1; // puede pasar de 23
  let best = null;
  for (let h = first; h < last; h++) {
    const avg = (curve[h % 24] + curve[(h + 1) % 24]) / 2;
    if (!best || avg > best.avg + 1e-9) best = { from: h % 24, to: (h + 2) % 24, avg: Math.round(avg * 100) / 100 };
  }
  return best;
}

export function weeklySummary(profile, tasks, checkins, now) {
  const today = startOfDay(now);
  const start = addDays(today, -6);
  const wake = parseHM(profile.wake);
  let sleep = parseHM(profile.sleep);
  if (sleep <= wake) sleep += 1440;

  // Tareas hechas en los últimos 7 días (incluido hoy)
  const perDay = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    return { date: ymd(d), dow: d.getDay(), count: 0, minutes: 0 };
  });
  const byEffort = { light: 0, medium: 0, hard: 0 };
  const done = [];
  for (const t of tasks) {
    if (t.status !== "done" || !t.doneAt) continue;
    const at = new Date(t.doneAt);
    const idx = diffDays(start, at);
    if (idx < 0 || idx > 6) continue;
    perDay[idx].count += 1;
    perDay[idx].minutes += t.minutes ?? 0;
    byEffort[t.effort ?? "medium"] += 1;
    done.push({ ...t, at });
  }
  const completedMinutes = done.reduce((acc, t) => acc + (t.minutes ?? 0), 0);

  // Check-ins de la semana
  const week = checkins.filter((c) => {
    const idx = diffDays(start, new Date(c.at));
    return idx >= 0 && idx <= 6;
  });
  const avgEnergy = week.length ? Math.round((week.reduce((a, c) => a + c.energy, 0) / week.length) * 10) / 10 : null;

  // Curva aprendida vs declarada
  const learned = learnCurve(profile.energy, checkins, now);
  const best = {
    weekday: bestWindow(learned.energy.weekday, wake, sleep),
    weekend: bestWindow(learned.energy.weekend, wake, sleep),
  };
  const declaredBest = {
    weekday: bestWindow(profile.energy.weekday, wake, sleep),
    weekend: bestWindow(profile.energy.weekend, wake, sleep),
  };

  // Tareas exigentes hechas en horas de poca energía
  const hardInLowEnergy = done.filter((t) => {
    if (t.effort !== "hard") return false;
    const kind = [0, 6].includes(t.at.getDay()) ? "weekend" : "weekday";
    return learned.energy[kind][t.at.getHours()] <= 2;
  }).length;

  const overdue = tasks.filter((t) => t.status === "todo" && t.due && t.due < ymd(today)).length;

  // Sugerencias, con lo positivo primero
  const suggestions = [];
  if (done.length >= 5) suggestions.push(`Buena semana: completaste ${done.length} tareas.`);
  else if (done.length === 0) suggestions.push("Semana tranquila. Sin culpa: cuando quieras retomar, el plan se acomoda solo.");

  if (week.length < MIN_CHECKINS_FOR_INSIGHTS) {
    suggestions.push("Con unos check-ins más voy a conocer mejor tus horarios de energía. Son solo dos toques.");
  } else {
    const diff = (a, b) => Math.min((a - b + 24) % 24, (b - a + 24) % 24);
    for (const [kind, label] of [["weekday", "entre semana"], ["weekend", "los fines de semana"]]) {
      if (best[kind] && declaredBest[kind] && diff(best[kind].from, declaredBest[kind].from) >= 2) {
        suggestions.push(`Tu mejor momento ${label} parece ser de ${best[kind].from} a ${best[kind].to} h, distinto de lo que habías marcado. Ya lo tengo en cuenta al planificar.`);
      }
    }
  }
  if (hardInLowEnergy >= 2) suggestions.push(`Hiciste ${hardInLowEnergy} tareas exigentes en horarios de poca energía. Probá reservar tus mejores horas para ellas.`);
  if (overdue > 0) suggestions.push(`Tenés ${overdue} ${overdue === 1 ? "tarea vencida" : "tareas vencidas"}. Revisala${overdue === 1 ? "" : "s"} en Tareas y movela${overdue === 1 ? "" : "s"} sin culpa.`);

  return {
    from: ymd(start),
    to: ymd(today),
    completed: done.length,
    completedMinutes,
    byEffort,
    perDay,
    checkins: week.length,
    avgEnergy,
    best,
    declaredBest,
    hardInLowEnergy,
    overdue,
    learned: learned.energy,
    suggestions,
  };
}
