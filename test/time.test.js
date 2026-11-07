import test from "node:test";
import assert from "node:assert/strict";
import {
  parseHM,
  formatHM,
  ymd,
  parseYMD,
  addDays,
  ceilTo,
  diffDays,
  isWeekend,
  minutesOfDay,
} from "../src/engine/time.js";

test("parseHM convierte horas a minutos", () => {
  assert.equal(parseHM("08:30"), 510);
  assert.equal(parseHM("0:05"), 5);
  assert.equal(parseHM("24:00"), 1440);
});

test("parseHM rechaza formatos inválidos", () => {
  assert.throws(() => parseHM("8"));
  assert.throws(() => parseHM("25:00"));
  assert.throws(() => parseHM("10:75"));
});

test("formatHM da la vuelta pasada la medianoche", () => {
  assert.equal(formatHM(510), "08:30");
  assert.equal(formatHM(1440 + 30), "00:30");
  assert.equal(formatHM(0), "00:00");
});

test("ymd y parseYMD son inversas", () => {
  const d = new Date(2026, 10, 9, 15, 20);
  assert.equal(ymd(d), "2026-11-09");
  assert.equal(ymd(parseYMD("2026-11-09")), "2026-11-09");
  assert.throws(() => parseYMD("09/11/2026"));
});

test("addDays cruza fin de mes y de año", () => {
  assert.equal(ymd(addDays(new Date(2026, 10, 29), 3)), "2026-12-02");
  assert.equal(ymd(addDays(new Date(2026, 11, 31), 1)), "2027-01-01");
});

test("ceilTo redondea hacia arriba", () => {
  assert.equal(ceilTo(501, 15), 510);
  assert.equal(ceilTo(510, 15), 510);
});

test("diffDays ignora la hora", () => {
  assert.equal(diffDays(new Date(2026, 10, 9, 23, 59), new Date(2026, 10, 10, 0, 1)), 1);
  assert.equal(diffDays(new Date(2026, 10, 10), new Date(2026, 10, 9)), -1);
});

test("isWeekend y minutesOfDay", () => {
  assert.equal(isWeekend(new Date(2026, 10, 7)), true); // sábado
  assert.equal(isWeekend(new Date(2026, 10, 9)), false); // lunes
  assert.equal(minutesOfDay(new Date(2026, 10, 9, 9, 15)), 555);
});
