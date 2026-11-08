import test from "node:test";
import assert from "node:assert/strict";
import { nextOccurrence, addMonths } from "../src/engine/repeat.js";
import { ymd } from "../src/engine/time.js";
import { plan } from "../src/engine/planner.js";
import { DEFAULT_ENERGY } from "../src/engine/energy.js";

const doneAt = new Date(2026, 10, 9, 18, 30); // lunes 9 nov

test("una tarea sin repetición no genera siguiente", () => {
  assert.equal(nextOccurrence({ id: "a" }, doneAt), null);
});

test("cada día, semana, 2 semanas y mes", () => {
  const next = (repeat) => ymd(new Date(nextOccurrence({ repeat }, doneAt).notBefore));
  assert.equal(next("day"), "2026-11-10");
  assert.equal(next("week"), "2026-11-16");
  assert.equal(next("2weeks"), "2026-11-23");
  assert.equal(next("month"), "2026-12-09");
});

test("la siguiente arranca pendiente y con las subtareas destildadas", () => {
  const r = nextOccurrence({ repeat: "week", subtasks: [{ id: "1", title: "x", done: true }] }, doneAt);
  assert.equal(r.status, "todo");
  assert.equal(r.doneAt, null);
  assert.equal(r.subtasks[0].done, false);
});

test("el mes no se desborda: 31 de enero + 1 mes = fin de febrero", () => {
  assert.equal(ymd(addMonths(new Date(2027, 0, 31), 1)), "2027-02-28");
  assert.equal(ymd(addMonths(new Date(2028, 0, 31), 1)), "2028-02-29");
  assert.equal(ymd(addMonths(new Date(2026, 11, 15), 1)), "2027-01-15");
});

test("si la tarea tenía fecha límite, la siguiente mantiene el ritmo", () => {
  const r = nextOccurrence({ repeat: "week", due: "2026-11-09" }, doneAt);
  assert.equal(r.due, "2026-11-16");
});

test("si se completó muy tarde, la fecha límite no queda en el pasado", () => {
  const r = nextOccurrence({ repeat: "week", due: "2026-10-01" }, doneAt);
  assert.ok(r.due >= "2026-11-16");
});

test("la siguiente ocurrencia no se planifica antes de su fecha", () => {
  const profile = {
    wake: "08:30", sleep: "00:30", energy: DEFAULT_ENERGY, breakMinutes: 10,
    freeMinutes: { weekday: 120, weekend: 240 }, fixedBlocks: [], oneOffBlocks: [],
  };
  const patch = nextOccurrence({ repeat: "day" }, doneAt);
  const t = { id: "ropa", title: "Lavar ropa", minutes: 30, effort: "light", ...patch };
  const r = plan(profile, [t], new Date(2026, 10, 9, 19, 0));
  const placed = r.days.flatMap((d) => d.items.filter((i) => i.taskId === "ropa").map(() => d.date));
  assert.ok(placed.length === 1 && placed[0] >= "2026-11-10", placed.join()); // no hoy: arranca mañana

  // Una semanal queda fuera del horizonte de 7 días y no se fuerza a entrar.
  const weekly = { id: "w", title: "w", minutes: 30, ...nextOccurrence({ repeat: "week" }, doneAt) };
  const r2 = plan(profile, [weekly], new Date(2026, 10, 9, 19, 0));
  assert.equal(r2.days.flatMap((d) => d.items.filter((i) => i.taskId === "w")).length, 0);
  assert.equal(r2.unplaced.length, 0, "no es una tarea sin lugar");
  assert.equal(r2.later.length, 1, "queda anotada para más adelante");
});
