import { test } from "node:test";
import assert from "node:assert/strict";
import { pointsFor, dayBonus, levelFor, outfit, nextAccessory, streakStats } from "../src/engine/streak.js";

const done = (y, m, d, extra = {}) => ({ id: `${y}${m}${d}`, status: "done", doneAt: new Date(y, m - 1, d, 12).toISOString(), minutes: 10, effort: "light", ...extra });
// Lunes 2 de noviembre de 2026
const FRI = new Date(2026, 10, 6, 15);

test("los puntos siguen a los minutos y al esfuerzo, con piso y techo", () => {
  assert.equal(pointsFor({ minutes: 10, effort: "light" }), 10);
  assert.equal(pointsFor({ minutes: 2, effort: "light" }), 5);
  assert.equal(pointsFor({ minutes: 60, effort: "hard" }), 90);
  assert.equal(pointsFor({ minutes: 240, effort: "hard" }), 100);
});

test("la racha cuenta días seguidos y hoy pendiente no la rompe", () => {
  const tasks = [done(2026, 11, 3), done(2026, 11, 4), done(2026, 11, 5)];
  const s = streakStats(tasks, FRI);
  assert.equal(s.current, 3);
  assert.equal(s.todayDone, false);
  assert.equal(s.last7.at(-1).state, "today");
  const s2 = streakStats([...tasks, done(2026, 11, 6)], FRI);
  assert.equal(s2.current, 4);
  assert.equal(s2.last7.at(-1).state, "done");
});

test("un día de descanso por semana no corta la racha ni suma", () => {
  const tasks = [done(2026, 11, 2), done(2026, 11, 4), done(2026, 11, 5), done(2026, 11, 6)];
  const s = streakStats(tasks, FRI);
  assert.equal(s.current, 4);
  assert.equal(s.last7.find((d) => d.date === "2026-11-03").state, "rest");
  assert.equal(s.restLeft, 0);
});

test("el segundo hueco de la misma semana corta la racha, pero queda el récord", () => {
  const tasks = [done(2026, 11, 2), done(2026, 11, 5), done(2026, 11, 6)];
  const s = streakStats(tasks, FRI);
  assert.equal(s.current, 2);
  assert.equal(s.best, 2);
  assert.equal(s.last7.find((d) => d.date === "2026-11-04").state, "miss");
});

test("sin descanso la racha es estricta", () => {
  const tasks = [done(2026, 11, 2), done(2026, 11, 4), done(2026, 11, 5)];
  assert.equal(streakStats(tasks, FRI, { rest: 0 }).current, 2);
});

test("el récord se mantiene aunque la racha actual vuelva a empezar", () => {
  const tasks = [done(2026, 10, 19), done(2026, 10, 20), done(2026, 10, 21), done(2026, 10, 22), done(2026, 11, 6)];
  const s = streakStats(tasks, FRI);
  assert.equal(s.best, 4);
  assert.equal(s.current, 1);
});

test("el total suma puntos de tareas y bonus por día cumplido", () => {
  const s = streakStats([done(2026, 11, 5), done(2026, 11, 6)], FRI);
  assert.equal(s.total, 10 + 10 + dayBonus(1) + dayBonus(2));
});

test("sin tareas hechas todo arranca en cero", () => {
  const s = streakStats([], FRI);
  assert.deepEqual([s.current, s.best, s.total, s.level.level], [0, 0, 0, 1]);
  assert.equal(s.last7.length, 7);
});

test("niveles, accesorios y siguiente hito", () => {
  assert.equal(levelFor(0).level, 1);
  assert.equal(levelFor(60).level, 2);
  assert.equal(levelFor(149).level, 2);
  assert.equal(levelFor(9999).level > 10, true);
  assert.deepEqual(outfit(7), { bow: true, scarf: true, hat: false, crown: false });
  assert.equal(outfit(30).hat, false);
  assert.equal(outfit(30).crown, true);
  assert.equal(nextAccessory(3).id, "scarf");
  assert.equal(nextAccessory(30), null);
});
