import { test } from "node:test";
import assert from "node:assert/strict";
import { ROUTINE_CATALOG, fromCatalog, syncRoutine, patchRoutineTasks, newRoutineId, PART_LABEL } from "../src/store/routine.js";
import { nextOccurrence } from "../src/engine/repeat.js";
import { validateProfile, defaultProfile, newBlockId } from "../src/store/profile.js";

const NOW = new Date(2026, 10, 8, 10);
let n = 0;
const id = () => `x${++n}`;
const item = (extra = {}) => ({ ...fromCatalog(ROUTINE_CATALOG[0]), ...extra });

test("apagar un ítem saca su tarea pendiente pero conserva las hechas", () => {
  const first = syncRoutine([item()], [{ id: "viejo", routineId: "platos", status: "done", title: "Platos" }], NOW, id);
  const off = syncRoutine([item({ on: false })], first.tasks, NOW, id);
  assert.equal(off.changed, true);
  assert.deepEqual(off.tasks.map((t) => t.id), ["viejo"]);
});

test("borrar un ítem de la rutina también saca la tarea pendiente", () => {
  const first = syncRoutine([item()], [], NOW, id);
  assert.equal(syncRoutine([], first.tasks, NOW, id).tasks.length, 0);
});

test("las tareas que no son de rutina no se tocan", () => {
  const mine = { id: "m", title: "Mía", status: "todo" };
  assert.deepEqual(syncRoutine([item()], [mine], NOW, id).tasks[0], mine);
  assert.deepEqual(syncRoutine(undefined, [mine], NOW, id).tasks, [mine]);
});

test("si quedaron repetidas se deja una sola", () => {
  const dup = [1, 2, 3].map((i) => ({ id: `d${i}`, routineId: "platos", status: "todo", title: "Platos" }));
  const r = syncRoutine([item()], dup, NOW, id);
  assert.equal(r.tasks.filter((t) => t.routineId === "platos").length, 1);
  assert.equal(r.changed, true);
});

test("la tarea creada respeta días y momento del día del ítem", () => {
  const r = syncRoutine([item({ days: [1, 3, 5], part: "morning" })], [], NOW, id).tasks[0];
  assert.deepEqual(r.days, [1, 3, 5]);
  assert.equal(r.part, "morning");
  assert.equal(r.status, "todo");
  assert.ok(r.createdAt);
});

test("patchRoutineTasks pasa los cambios al pendiente y no toca lo hecho", () => {
  const tasks = [
    { id: "a", routineId: "platos", status: "todo", title: "Platos", minutes: 10 },
    { id: "b", routineId: "platos", status: "done", title: "Platos", minutes: 10 },
    { id: "c", status: "todo", title: "Otra", minutes: 10 },
  ];
  patchRoutineTasks(item({ title: "Lavar todo", minutes: 20, days: [2], part: "evening" }), tasks);
  assert.deepEqual([tasks[0].title, tasks[0].minutes, tasks[0].days, tasks[0].part], ["Lavar todo", 20, [2], "evening"]);
  assert.equal(tasks[1].minutes, 10);
  assert.equal(tasks[2].title, "Otra");
  patchRoutineTasks(item({ days: [] }), tasks);
  assert.equal(tasks[0].days, null);
});

test("los ids nuevos no se repiten y el catálogo es consistente", () => {
  assert.notEqual(newRoutineId(), newRoutineId());
  assert.notEqual(newBlockId(), newBlockId());
  const keys = ROUTINE_CATALOG.map((c) => c.key);
  assert.equal(new Set(keys).size, keys.length);
  for (const c of ROUTINE_CATALOG) {
    assert.ok(c.title && c.minutes >= 1 && ["light", "medium", "hard"].includes(c.effort), c.key);
    assert.ok(["day", "week"].includes(c.repeat), c.key);
  }
  assert.deepEqual(Object.keys(PART_LABEL), ["morning", "afternoon", "evening"]);
});

test("validación de la rutina y la mascota", () => {
  const p = defaultProfile();
  assert.deepEqual(validateProfile({ ...p, routine: [item()] }), []);
  assert.ok(validateProfile({ ...p, routine: [{ id: "", title: "" }] }).some((e) => /nombre/i.test(e)));
  assert.ok(validateProfile({ ...p, routine: [item({ minutes: 0 })] }).some((e) => /duraci/i.test(e)));
  assert.ok(validateProfile({ ...p, pet: { bought: [], spent: -1 } }).length);
  assert.ok(validateProfile({ ...p, pet: { bought: [], spent: 0, worn: "gafas" } }).length);
  assert.deepEqual(validateProfile({ ...p, pet: { bought: ["flower"], spent: 40, worn: null } }), []);
  assert.ok(validateProfile({ ...p, oneOffBlocks: [{ date: "mal", start: "09:00", end: "10:00" }] }).some((e) => /fecha/i.test(e)));
  assert.ok(validateProfile({ ...p, oneOffBlocks: [{ date: "2026-11-09", start: "10:00", end: "09:00" }] }).some((e) => /después/i.test(e)));
});

test("repeticiones con días elegidos: casos de borde", () => {
  const base = { id: "t", title: "T", status: "done", subtasks: [] };
  const sat = new Date(2026, 10, 7, 12); // sábado
  const daily = nextOccurrence({ ...base, repeat: "day", days: [6] }, sat);
  assert.equal(new Date(daily.notBefore).getDay(), 6);
  assert.ok(new Date(daily.notBefore) > sat);
  const weekly = nextOccurrence({ ...base, repeat: "week", days: [1, 3] }, sat);
  assert.equal(new Date(weekly.notBefore).getDay(), 1); // el primer día permitido de la semana siguiente
  assert.equal(nextOccurrence({ ...base, repeat: null }, sat), null);
  const month = nextOccurrence({ ...base, repeat: "month", due: "2026-01-31" }, new Date(2026, 0, 31));
  assert.ok(month);
});
