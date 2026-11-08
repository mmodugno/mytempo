import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { defaultProfile, validateProfile } from "../src/store/profile.js";
import { createStore, memoryBackend } from "../src/store/storage.js";
import { plan } from "../src/engine/planner.js";

const ejemplo = JSON.parse(readFileSync(new URL("../data/perfil-ejemplo.json", import.meta.url), "utf8"));

test("el perfil por defecto es válido", () => {
  assert.deepEqual(validateProfile(defaultProfile()), []);
});

test("el perfil de ejemplo es válido", () => {
  assert.deepEqual(validateProfile(ejemplo), []);
});

test("detecta horas, días y curvas inválidos", () => {
  const p = defaultProfile();
  p.wake = "25:00";
  p.energy.weekday = [1, 2, 3];
  p.fixedBlocks = [{ title: "Raro", days: [9], start: "10:00", end: "09:00" }];
  const errors = validateProfile(p);
  assert.ok(errors.some((e) => e.includes("despertar")));
  assert.ok(errors.some((e) => e.includes("curva de energía")));
  assert.ok(errors.some((e) => e.includes("días")));
  assert.ok(errors.some((e) => e.includes("después del inicio")));
});

test("el store devuelve el perfil por defecto si no hay nada guardado", () => {
  const store = createStore(memoryBackend());
  assert.equal(store.hasProfile(), false);
  assert.deepEqual(store.getProfile(), defaultProfile());
});

test("guarda y recupera perfil, tareas y check-ins", () => {
  const store = createStore(memoryBackend());
  store.saveProfile(ejemplo);
  store.saveTasks([{ id: "1", title: "Lavar ropa" }]);
  store.addCheckin({ energy: 4, focus: 3, at: new Date(2026, 10, 9, 10, 0) });
  assert.equal(store.hasProfile(), true);
  assert.equal(store.getProfile().name, "Ejemplo");
  assert.equal(store.getTasks()[0].title, "Lavar ropa");
  assert.equal(store.getCheckins()[0].energy, 4);
});

test("no guarda un perfil inválido", () => {
  const store = createStore(memoryBackend());
  assert.throws(() => store.saveProfile({ ...defaultProfile(), wake: "xx" }), /despertar/);
  assert.equal(store.hasProfile(), false);
});

test("un dato corrupto no rompe la app", () => {
  const backend = memoryBackend();
  backend.setItem("mytempo.tasks", "{no es json");
  const store = createStore(backend);
  assert.deepEqual(store.getTasks(), []);
});

test("exporta e importa un respaldo completo", () => {
  const a = createStore(memoryBackend());
  a.saveProfile(ejemplo);
  a.saveTasks([{ id: "1", title: "Estudiar" }]);
  const json = a.exportAll();

  const b = createStore(memoryBackend());
  b.importAll(json);
  assert.equal(b.getProfile().name, "Ejemplo");
  assert.equal(b.getTasks().length, 1);
});

test("importa también un perfil suelto", () => {
  const store = createStore(memoryBackend());
  store.importAll(JSON.stringify(ejemplo));
  assert.equal(store.getProfile().fixedBlocks.length, ejemplo.fixedBlocks.length);
});

test("rechaza archivos que no sirven", () => {
  const store = createStore(memoryBackend());
  assert.throws(() => store.importAll("hola"), /JSON válido/);
  assert.throws(() => store.importAll("{}"), /perfil/);
});

test("el foco se agrega después al último check-in", () => {
  const store = createStore(memoryBackend());
  store.setLastCheckinFocus(2); // sin check-ins: no hace nada ni rompe
  store.addCheckin({ energy: 4, at: new Date(2026, 10, 9, 10, 0) });
  assert.equal(store.getCheckins()[0].focus, null);
  store.setLastCheckinFocus(2);
  assert.equal(store.getCheckins()[0].focus, 2);
});

test("guarda como máximo 500 check-ins", () => {
  const store = createStore(memoryBackend());
  for (let i = 0; i < 510; i++) store.addCheckin({ energy: 3, at: new Date(2026, 10, 9, 10, 0) });
  assert.equal(store.getCheckins().length, 500);
});

// Integración: la semana real de la usuaria con el motor.
test("con el perfil de ejemplo, lo exigente cae en las mañanas libres y lo liviano en las noches", () => {
  const now = new Date(2026, 10, 7, 8, 0); // sábado
  const tasks = [
    { id: "estudiar", title: "Estudiar el curso", minutes: 90, effort: "hard", status: "todo" },
    { id: "ordenar", title: "Ordenar el cuarto", minutes: 60, effort: "medium", status: "todo" },
    { id: "ropa", title: "Lavar la ropa", minutes: 30, effort: "light", status: "todo" },
  ];
  const r = plan(ejemplo, tasks, now);
  const find = (id) => r.days.flatMap((d) => d.items.filter((i) => i.taskId === id).map((i) => ({ ...i, date: d.date })))[0];
  const estudiar = find("estudiar");
  const ropa = find("ropa");
  assert.ok(estudiar.start >= 9 * 60 && estudiar.start < 13 * 60, `estudiar a las ${estudiar.start}`);
  assert.ok(ropa.start >= 13 * 60 || ropa.start < 9 * 60, "lo liviano no ocupa la mañana clara");
  assert.equal(r.unplaced.length, 0);
});

test("con el perfil de ejemplo nada pisa los horarios fijos", () => {
  const tasks = Array.from({ length: 25 }, (_, i) => ({ id: `t${i}`, title: `T${i}`, minutes: 30, status: "todo" }));
  const r = plan(ejemplo, tasks, new Date(2026, 10, 9, 8, 0)); // lunes
  for (const day of r.days) {
    const fixed = day.items.filter((i) => i.type === "fixed");
    for (const t of day.items.filter((i) => i.type === "task")) {
      for (const f of fixed) assert.ok(t.end <= f.start || t.start >= f.end, `${t.title} pisa ${f.title} el ${day.date}`);
    }
  }
});
