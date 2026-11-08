import test from "node:test";
import assert from "node:assert/strict";
import { learnCurve, effectiveProfile, checkinValue, PRIOR_WEIGHT } from "../src/engine/learn.js";
import { DEFAULT_ENERGY } from "../src/engine/energy.js";

const now = new Date(2026, 10, 9, 12, 0); // lunes
const ci = (daysAgo, hour, energy, focus = null) => ({
  at: new Date(2026, 10, 9 - daysAgo, hour, 0).toISOString(),
  energy,
  focus,
});

test("sin check-ins la curva queda igual a la declarada", () => {
  const r = learnCurve(DEFAULT_ENERGY, [], now);
  assert.deepEqual(r.energy.weekday, DEFAULT_ENERGY.weekday);
  assert.ok(r.samples.weekday.every((n) => n === 0));
});

test("con pocos check-ins la curva se mueve poco", () => {
  const r = learnCurve(DEFAULT_ENERGY, [ci(0, 10, 1)], now); // lunes 10h: declarada 5, siente 1
  const v = r.energy.weekday[10];
  assert.ok(v < 5 && v > 3.5, `valor ${v}`);
});

test("con muchos check-ins manda lo observado", () => {
  const r = learnCurve(DEFAULT_ENERGY, Array(20).fill(ci(0, 10, 2)), now); // 20 lunes a las 10h con energía 2
  assert.ok(r.energy.weekday[10] < 3, `valor ${r.energy.weekday[10]}`);
});

test("días de semana y fin de semana se aprenden por separado", () => {
  const sabado = { at: new Date(2026, 10, 7, 10, 0).toISOString(), energy: 1 };
  const r = learnCurve(DEFAULT_ENERGY, Array(10).fill(sabado), now);
  assert.ok(r.energy.weekend[10] < 3);
  assert.equal(r.energy.weekday[10], DEFAULT_ENERGY.weekday[10]);
});

test("una observación también informa las horas vecinas, pero menos", () => {
  const r = learnCurve(DEFAULT_ENERGY, Array(6).fill(ci(0, 10, 1)), now);
  const own = DEFAULT_ENERGY.weekday[10] - r.energy.weekday[10];
  const next = DEFAULT_ENERGY.weekday[11] - r.energy.weekday[11];
  const far = DEFAULT_ENERGY.weekday[14] - r.energy.weekday[14];
  assert.ok(own > next && next > 0);
  assert.equal(far, 0);
});

test("los check-ins viejos pesan menos que los recientes", () => {
  const reciente = learnCurve(DEFAULT_ENERGY, Array(6).fill(ci(0, 10, 1)), now).energy.weekday[10];
  const viejo = learnCurve(DEFAULT_ENERGY, Array(6).fill(ci(56, 10, 1)), now).energy.weekday[10];
  assert.ok(viejo > reciente);
});

test("el foco se mezcla con la energía", () => {
  assert.equal(checkinValue({ energy: 4, focus: null }), 4);
  assert.ok(checkinValue({ energy: 4, focus: 1 }) < 4);
});

test("ignora datos inválidos sin romperse", () => {
  const r = learnCurve(DEFAULT_ENERGY, [{ at: "basura", energy: 3 }, { at: now.toISOString(), energy: 9 }], now);
  assert.deepEqual(r.energy.weekday, DEFAULT_ENERGY.weekday);
});

test("effectiveProfile respeta el interruptor de aprendizaje", () => {
  const profile = { energy: DEFAULT_ENERGY, learn: false };
  assert.equal(effectiveProfile(profile, Array(10).fill(ci(0, 10, 1)), now), profile);
  const on = effectiveProfile({ energy: DEFAULT_ENERGY }, Array(10).fill(ci(0, 10, 1)), now);
  assert.notDeepEqual(on.energy, DEFAULT_ENERGY);
});

test("el peso de la curva declarada es el esperado", () => {
  assert.equal(PRIOR_WEIGHT, 4);
});
