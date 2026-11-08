import test from "node:test";
import assert from "node:assert/strict";
import { weeklySummary, bestWindow } from "../src/engine/summary.js";
import { DEFAULT_ENERGY } from "../src/engine/energy.js";

const profile = { wake: "08:30", sleep: "00:30", energy: DEFAULT_ENERGY };
const now = new Date(2026, 10, 9, 20, 0); // lunes 9 de nov
const at = (daysAgo, hour) => new Date(2026, 10, 9 - daysAgo, hour, 0).toISOString();
const done = (id, daysAgo, hour, extra = {}) => ({ id, title: id, status: "done", minutes: 30, effort: "medium", doneAt: at(daysAgo, hour), ...extra });

test("bestWindow encuentra las 2 horas más altas dentro del horario despierta", () => {
  const w = bestWindow(DEFAULT_ENERGY.weekday, 8 * 60 + 30, 24 * 60 + 30);
  assert.equal(w.from, 9);
  assert.equal(w.to, 11);
  assert.equal(w.avg, 5);
});

test("cuenta lo hecho en los últimos 7 días y descarta lo anterior", () => {
  const tasks = [done("a", 0, 10), done("b", 3, 11, { effort: "hard", minutes: 60 }), done("vieja", 8, 10)];
  const s = weeklySummary(profile, tasks, [], now);
  assert.equal(s.completed, 2);
  assert.equal(s.completedMinutes, 90);
  assert.equal(s.byEffort.hard, 1);
  assert.equal(s.perDay.length, 7);
  assert.equal(s.perDay[6].count, 1); // hoy
  assert.equal(s.perDay[3].count, 1); // hace 3 días
});

test("con pocos check-ins invita a hacer más, sin reproche", () => {
  const s = weeklySummary(profile, [done("a", 0, 10)], [{ at: at(0, 9), energy: 4 }], now);
  assert.ok(s.suggestions.some((x) => x.includes("check-ins")));
  assert.equal(s.checkins, 1);
});

test("semana sin tareas hechas: mensaje amable", () => {
  const s = weeklySummary(profile, [], [], now);
  assert.ok(s.suggestions[0].includes("Sin culpa"));
  assert.equal(s.completed, 0);
});

test("semana buena: lo positivo va primero", () => {
  const tasks = Array.from({ length: 6 }, (_, i) => done(`t${i}`, i % 5, 10));
  const s = weeklySummary(profile, tasks, [], now);
  assert.match(s.suggestions[0], /Buena semana/);
});

test("detecta cuando rinde mejor en otro horario que el declarado", () => {
  // Lunes a las 16-17h con energía 5 muchas veces, y a las 9-11 con energía 1
  const checkins = [];
  for (let d = 0; d < 6; d++) {
    for (const hour of [9, 10, 11]) checkins.push({ at: at(d === 0 ? 0 : d, hour), energy: 1 });
    for (const hour of [15, 16, 17]) checkins.push({ at: at(d === 0 ? 0 : d, hour), energy: 5 });
  }
  const s = weeklySummary(profile, [], checkins, now);
  assert.ok(s.checkins >= 5);
  assert.ok(s.suggestions.some((x) => x.includes("mejor momento")), s.suggestions.join(" | "));
});

test("avisa de tareas exigentes hechas con poca energía", () => {
  const tasks = [done("a", 1, 22, { effort: "hard" }), done("b", 2, 22, { effort: "hard" })];
  const s = weeklySummary(profile, tasks, [], now);
  assert.equal(s.hardInLowEnergy, 2);
  assert.ok(s.suggestions.some((x) => x.includes("exigentes")));
});

test("avisa de tareas vencidas sin culpa", () => {
  const tasks = [{ id: "v", title: "v", status: "todo", due: "2026-11-01" }];
  const s = weeklySummary(profile, tasks, [], now);
  assert.equal(s.overdue, 1);
  assert.ok(s.suggestions.some((x) => x.includes("sin culpa")));
});

test("promedio de energía de la semana", () => {
  const s = weeklySummary(profile, [], [{ at: at(0, 9), energy: 4 }, { at: at(1, 9), energy: 2 }], now);
  assert.equal(s.avgEnergy, 3);
});
