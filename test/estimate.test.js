import test from "node:test";
import assert from "node:assert/strict";
import { estimate, actualFrom, words } from "../src/engine/estimate.js";

test("tareas distintas dan duraciones distintas, no todo 30", () => {
  assert.equal(estimate("Llamar al banco").minutes, 15);
  assert.equal(estimate("Estudiar módulo 3").minutes, 90);
  assert.equal(estimate("Lavar la ropa").minutes, 30);
  assert.equal(estimate("Regar las plantas").minutes, 10);
  assert.equal(estimate("Lavar los platos").minutes, 10); // no 30 por "lavar"
  assert.equal(estimate("Lavar la vajilla").minutes, 10);
});

test("infiere el esfuerzo mental por palabras clave", () => {
  assert.equal(estimate("Estudiar para el parcial").effort, "hard");
  assert.equal(estimate("Pagar expensas").effort, "light");
  assert.equal(estimate("Ordenar el cuarto").effort, "medium");
});

test("sin pistas usa un valor intermedio", () => {
  const e = estimate("Cosa rara");
  assert.equal(e.source, "default");
  assert.equal(e.minutes, 45);
  assert.equal(e.effort, "medium");
});

test("aprende de lo que la persona cargó antes en tareas parecidas", () => {
  const history = [{ title: "Ordenar el cuarto", minutes: 90, minutesAuto: false, effort: "medium", status: "done" }];
  const e = estimate("Ordenar cuarto", history);
  assert.equal(e.source, "history");
  assert.equal(e.minutes, 90);
});

test("prefiere lo medido (actualMinutes) a lo estimado", () => {
  const history = [{ title: "Lavar la ropa", minutes: 30, minutesAuto: false, actualMinutes: 60, status: "done" }];
  assert.equal(estimate("Lavar ropa", history).minutes, 60);
});

test("ignora tareas parecidas cuya duración era solo una estimación automática", () => {
  const history = [{ title: "Lavar la ropa", minutes: 30, minutesAuto: true, status: "done" }];
  assert.equal(estimate("Lavar la ropa", history).source, "keyword");
});

test("usa la mediana de varias veces, no un caso aislado", () => {
  const mk = (m) => ({ title: "Limpiar baño", minutes: m, minutesAuto: false });
  assert.equal(estimate("Limpiar el baño", [mk(40), mk(45), mk(120)]).minutes, 45);
});

test("no confunde tareas que no se parecen", () => {
  const history = [{ title: "Estudiar inglés", minutes: 120, minutesAuto: false }];
  assert.notEqual(estimate("Pagar la luz", history).source, "history");
});

test("actualFrom ajusta según la respuesta y redondea a 5", () => {
  assert.equal(actualFrom(60, "menos"), 30);
  assert.equal(actualFrom(60, "previsto"), 60);
  assert.equal(actualFrom(60, "mas"), 90);
  assert.equal(actualFrom(20, "menos"), 10);
  assert.equal(actualFrom(10, "menos"), 5);
});

test("words ignora tildes y palabras vacías", () => {
  assert.deepEqual(words("Llamar al médico para el turno"), ["llamar", "al", "medico", "el", "turno"].filter((w) => w.length > 1));
});
