import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_ENERGY, energyAt, avgEnergy, checkinShift, energyInterp } from "../src/engine/energy.js";

const profile = { energy: DEFAULT_ENERGY };
const lunes = new Date(2026, 10, 9);
const sabado = new Date(2026, 10, 7);

test("las curvas por defecto tienen 24 valores entre 1 y 5", () => {
  for (const curve of [DEFAULT_ENERGY.weekday, DEFAULT_ENERGY.weekend]) {
    assert.equal(curve.length, 24);
    assert.ok(curve.every((v) => v >= 1 && v <= 5));
  }
});

test("energyAt lee la hora correcta y da la vuelta pasada la medianoche", () => {
  assert.equal(energyAt(profile, lunes, 10 * 60), 5);
  assert.equal(energyAt(profile, lunes, 22 * 60 + 30), 1);
  assert.equal(energyAt(profile, lunes, 24 * 60 + 30), energyAt(profile, lunes, 30));
});

test("avgEnergy promedia entre dos horas distintas", () => {
  // 11:00-13:00 => 5 y 4 => 4.5
  assert.equal(avgEnergy(profile, lunes, 11 * 60, 13 * 60), 4.5);
});

test("usa la curva de fin de semana el sábado", () => {
  assert.equal(energyAt(profile, sabado, 9 * 60), 4);
  assert.equal(energyAt(profile, lunes, 9 * 60), 5);
});

test("un check-in bajo reduce la energía y el efecto se apaga con el tiempo", () => {
  const at = new Date(2026, 10, 9, 10, 0);
  const checkin = { energy: 1, at }; // la curva dice 5, ella siente 1
  const justAfter = checkinShift(profile, lunes, 10 * 60, checkin);
  const later = checkinShift(profile, lunes, 12 * 60, checkin);
  const gone = checkinShift(profile, lunes, 14 * 60, checkin);
  assert.equal(justAfter, -4);
  assert.ok(later > justAfter && later < 0);
  assert.equal(gone, 0);
});

test("el check-in no afecta a otros días", () => {
  const checkin = { energy: 1, at: new Date(2026, 10, 9, 10, 0) };
  assert.equal(checkinShift(profile, new Date(2026, 10, 10), 10 * 60, checkin), 0);
});

test("avgEnergy incorpora el check-in y nunca baja de 1 ni pasa de 5", () => {
  const checkin = { energy: 1, at: new Date(2026, 10, 9, 10, 0) };
  const v = avgEnergy(profile, lunes, 10 * 60, 11 * 60, checkin);
  assert.ok(v >= 1 && v < 5);
});

test("energyInterp vale lo de la hora en su centro y mezcla entre horas", () => {
  const curve = DEFAULT_ENERGY.weekday;
  assert.equal(energyInterp(curve, 10 * 60 + 30), curve[10]); // centro de la hora 10
  const entre = energyInterp(curve, 12 * 60 + 30 + 30); // a mitad de camino entre hora 12 y 13
  assert.equal(entre, (curve[12] + curve[13]) / 2);
});

test("energyInterp da la vuelta a medianoche sin romperse", () => {
  const curve = DEFAULT_ENERGY.weekday;
  const v = energyInterp(curve, 24 * 60);
  assert.ok(v >= 1 && v <= 5);
  assert.equal(energyInterp(curve, 24 * 60 + 30), curve[0]);
});
