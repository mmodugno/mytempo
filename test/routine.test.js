import { test } from "node:test";
import assert from "node:assert/strict";
import { ROUTINE_CATALOG, fromCatalog, syncRoutine } from "../src/store/routine.js";

const NOW = new Date(2026, 10, 8, 10);
let n = 0;
const id = () => `t${++n}`;
const platos = fromCatalog(ROUTINE_CATALOG[0]);

test("crea una tarea repetida por cada ítem activo", () => {
  const { tasks, changed } = syncRoutine([platos, { ...fromCatalog(ROUTINE_CATALOG[5]) }], [], NOW, id);
  assert.equal(changed, true);
  assert.equal(tasks.length, 2);
  assert.deepEqual([tasks[0].minutes, tasks[0].effort, tasks[0].repeat, tasks[0].routineId], [10, "light", "day", "platos"]);
  assert.equal(tasks[1].repeat, "week");
});

test("es idempotente: una segunda pasada no cambia nada", () => {
  const first = syncRoutine([platos], [], NOW, id);
  const second = syncRoutine([platos], first.tasks, NOW, id);
  assert.equal(second.changed, false);
  assert.equal(second.tasks.length, 1);
});

test("si hoy ya está hecha y mañana ya hay otra pendiente, no duplica", () => {
  const tasks = [
    { id: "a", routineId: "platos", status: "done", title: "Lavar los platos", minutes: 10, effort: "light", repeat: "day" },
    { id: "b", routineId: "platos", status: "todo", title: "Lavar los platos", minutes: 10, effort: "light", repeat: "day" },
  ];
  const r = syncRoutine([platos], tasks, NOW, id);
  assert.equal(r.changed, false);
  assert.equal(r.tasks.length, 2);
});

test("apagar o borrar un ítem saca la pendiente pero deja el historial", () => {
  const tasks = [
    { id: "a", routineId: "platos", status: "done", doneAt: NOW.toISOString() },
    { id: "b", routineId: "platos", status: "todo", title: "x", minutes: 10, effort: "light", repeat: "day" },
  ];
  const off = syncRoutine([{ ...platos, on: false }], tasks, NOW, id);
  assert.deepEqual(off.tasks.map((t) => t.id), ["a"]);
  const gone = syncRoutine([], tasks, NOW, id);
  assert.deepEqual(gone.tasks.map((t) => t.id), ["a"]);
});

test("lo que editaste en una tarea de rutina se respeta", () => {
  const first = syncRoutine([platos], [], NOW, id);
  first.tasks[0].minutes = 8;
  const r = syncRoutine([platos], first.tasks, NOW, id);
  assert.equal(r.changed, false);
  assert.equal(r.tasks[0].minutes, 8);
});

test("las tareas que no son de rutina no se tocan", () => {
  const manual = { id: "m", title: "Llamar", status: "todo" };
  const r = syncRoutine([], [manual], NOW, id);
  assert.deepEqual(r.tasks, [manual]);
});
