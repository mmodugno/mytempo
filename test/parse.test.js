import test from "node:test";
import assert from "node:assert/strict";
import { parseQuickTask } from "../src/engine/parse.js";

const lunes = new Date(2026, 10, 9, 10, 0);

test("solo título: no inventa datos", () => {
  assert.deepEqual(parseQuickTask("Lavar la ropa", lunes), { title: "Lavar la ropa" });
});

test("reconoce minutos y horas", () => {
  assert.equal(parseQuickTask("Llamar al banco 15m", lunes).minutes, 15);
  assert.equal(parseQuickTask("Ordenar cuarto 45 min", lunes).minutes, 45);
  assert.equal(parseQuickTask("Estudiar 2h", lunes).minutes, 120);
  assert.equal(parseQuickTask("Estudiar 1h30", lunes).minutes, 90);
  assert.equal(parseQuickTask("Estudiar 1,5h", lunes).minutes, 90);
});

test("el título queda limpio", () => {
  const r = parseQuickTask("Estudiar módulo 3 1h30 mañana !", lunes);
  assert.equal(r.title, "Estudiar módulo 3");
  assert.equal(r.minutes, 90);
  assert.equal(r.due, "2026-11-10");
  assert.equal(r.priority, 3);
});

test("hoy y mañana", () => {
  assert.equal(parseQuickTask("Pagar luz hoy", lunes).due, "2026-11-09");
  assert.equal(parseQuickTask("Pagar luz mañana", lunes).due, "2026-11-10");
});

test("día de la semana: el próximo que venga", () => {
  assert.equal(parseQuickTask("Entregar TP viernes", lunes).due, "2026-11-13");
  // si hoy es lunes y dice lunes, es el lunes siguiente
  assert.equal(parseQuickTask("Reunión lunes", lunes).due, "2026-11-16");
  assert.equal(parseQuickTask("Cumple sábado", lunes).due, "2026-11-14");
});

test("esfuerzo con hashtag", () => {
  const r = parseQuickTask("Armar informe #exigente 2h", lunes);
  assert.equal(r.effort, "hard");
  assert.equal(r.title, "Armar informe");
  assert.equal(parseQuickTask("Regar plantas #liviana", lunes).effort, "light");
});

test("no confunde números del título con duración", () => {
  const r = parseQuickTask("Leer capítulo 3", lunes);
  assert.equal(r.minutes, undefined);
  assert.equal(r.title, "Leer capítulo 3");
});

test("palabras que contienen un día no se tocan", () => {
  assert.equal(parseQuickTask("Comprar lunetas", lunes).due, undefined);
});

test("repeticiones", () => {
  assert.equal(parseQuickTask("Lavar la ropa cada semana", lunes).repeat, "week");
  assert.equal(parseQuickTask("Regar plantas todos los días 10m", lunes).repeat, "day");
  assert.equal(parseQuickTask("Cambiar sábanas cada 2 semanas", lunes).repeat, "2weeks");
  assert.equal(parseQuickTask("Pagar alquiler mensual", lunes).repeat, "month");
});

test("la repetición se saca del título y convive con duración y esfuerzo", () => {
  const r = parseQuickTask("Lavar la ropa cada semana 30m #liviana", lunes);
  assert.equal(r.title, "Lavar la ropa");
  assert.equal(r.repeat, "week");
  assert.equal(r.minutes, 30);
  assert.equal(r.effort, "light");
});

test("sin repetición no inventa el campo", () => {
  assert.equal(parseQuickTask("Lavar la ropa", lunes).repeat, undefined);
});
