import test from "node:test";
import assert from "node:assert/strict";
import { plan } from "../src/engine/planner.js";
import { DEFAULT_ENERGY } from "../src/engine/energy.js";
import { parseHM, parseYMD } from "../src/engine/time.js";

// Perfil mínimo: trabajo 9-18 de lunes a viernes, el resto libre.
const profile = {
  wake: "08:30",
  sleep: "00:30",
  energy: DEFAULT_ENERGY,
  breakMinutes: 10,
  freeMinutes: { weekday: 120, weekend: 240 },
  fixedBlocks: [{ title: "Trabajo", kind: "work", days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00" }],
  oneOffBlocks: [],
};

const lunes10 = new Date(2026, 10, 9, 10, 0); // lunes 9 de nov, 10:00
const lunes8 = new Date(2026, 10, 9, 8, 0);
const sabado8 = new Date(2026, 10, 7, 8, 0);

const task = (id, extra = {}) => ({ id, title: id, status: "todo", ...extra });
const itemsOf = (result, type = "task") =>
  result.days.flatMap((d) => d.items.filter((i) => i.type === type).map((i) => ({ ...i, date: d.date })));

test("sin tareas devuelve los bloques fijos y ningún pendiente", () => {
  const r = plan(profile, [], lunes8);
  assert.equal(r.days.length, 7);
  assert.equal(r.unplaced.length, 0);
  const lunes = r.days[0];
  assert.ok(lunes.items.some((i) => i.title === "Trabajo"));
  assert.ok(!r.days[5].items.some((i) => i.title === "Trabajo")); // sábado
});

test("nunca coloca tareas sobre bloques fijos", () => {
  const tasks = Array.from({ length: 8 }, (_, i) => task(`t${i}`, { minutes: 45, effort: "medium" }));
  const r = plan(profile, tasks, lunes8);
  for (const day of r.days) {
    const busy = day.items.filter((i) => i.type === "fixed");
    for (const t of day.items.filter((i) => i.type === "task")) {
      for (const b of busy) assert.ok(t.end <= b.start || t.start >= b.end, `${t.title} pisa ${b.title}`);
    }
  }
});

test("no hay dos tareas ni pausas superpuestas", () => {
  const tasks = Array.from({ length: 10 }, (_, i) => task(`t${i}`, { minutes: 30 }));
  const r = plan(profile, tasks, sabado8);
  for (const day of r.days) {
    const sorted = [...day.items].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) assert.ok(sorted[i].start >= sorted[i - 1].end);
  }
});

test("una tarea exigente va a un momento de energía alta", () => {
  const r = plan(profile, [task("estudiar", { minutes: 60, effort: "hard" })], sabado8);
  const [t] = itemsOf(r);
  assert.ok(t.start >= parseHM("09:00") && t.start < parseHM("13:00"), `empezó a las ${t.start}`);
  assert.equal(t.date, "2026-11-07");
});

test("una tarea liviana va a un momento de energía baja", () => {
  const r = plan(profile, [task("lavar", { minutes: 30, effort: "light" })], lunes10);
  const [t] = itemsOf(r);
  assert.ok(t.start >= parseHM("18:00"), `empezó a las ${t.start}`);
});

test("lo exigente y lo liviano no se pisan por el mismo hueco", () => {
  const r = plan(profile, [task("a", { effort: "hard", minutes: 60 }), task("b", { effort: "light", minutes: 60 })], sabado8);
  const [a, b] = ["a", "b"].map((id) => itemsOf(r).find((t) => t.taskId === id));
  assert.ok(a.start < b.start || a.date < b.date, "lo exigente va antes que lo liviano del sábado");
});

test("respeta la fecha límite", () => {
  const r = plan(profile, [task("trámite", { minutes: 30, effort: "light", due: "2026-11-10" })], lunes8);
  const [t] = itemsOf(r);
  assert.ok(t.date <= "2026-11-10");
});

test("lo más urgente se coloca primero", () => {
  const tasks = [task("tarde", { due: "2026-11-20", minutes: 60 }), task("urgente", { due: "2026-11-09", minutes: 60 })];
  const r = plan(profile, tasks, lunes10);
  const urgent = itemsOf(r).find((t) => t.taskId === "urgente");
  assert.equal(urgent.date, "2026-11-09");
});

test("una tarea vencida se trata como para hoy", () => {
  const r = plan(profile, [task("vencida", { due: "2026-11-01", minutes: 30 })], lunes10);
  const [t] = itemsOf(r);
  assert.equal(t.date, "2026-11-09");
});

test("si no hay lugar antes del vencimiento queda sin ubicar, con motivo", () => {
  // Hoy lunes a las 23:30: ya no queda día útil antes del vencimiento de hoy.
  const now = new Date(2026, 10, 9, 23, 50);
  const r = plan(profile, [task("imposible", { due: "2026-11-09", minutes: 120 })], now);
  assert.equal(r.unplaced.length, 1);
  assert.equal(r.unplaced[0].reason, "no-room-before-due");
});

test("respeta el tiempo libre: no llena todo el día", () => {
  const tasks = Array.from({ length: 120 }, (_, i) => task(`t${i}`, { minutes: 30 }));
  const r = plan(profile, tasks, sabado8);
  const sab = r.days[0];
  const placed = sab.items.filter((i) => i.type === "task").reduce((acc, i) => acc + (i.end - i.start), 0);
  const total = parseHM("00:30") + 1440 - parseHM("08:30");
  assert.ok(total - placed >= 240, "debe quedar al menos el tiempo libre del fin de semana");
  assert.ok(r.unplaced.length > 0, "con la semana saturada, algo queda sin ubicar");
});

test("las tareas largas se parten en bloques de hasta 90 minutos", () => {
  const r = plan(profile, [task("curso", { minutes: 200, effort: "hard" })], sabado8);
  const parts = itemsOf(r).filter((t) => t.taskId === "curso");
  assert.equal(parts.length, 3);
  assert.equal(parts.reduce((acc, p) => acc + (p.end - p.start), 0), 200);
  assert.ok(parts.every((p) => p.end - p.start <= 90));
});

test("las tareas hechas o salteadas no se planifican", () => {
  const r = plan(profile, [task("a", { status: "done" }), task("b", { status: "skipped" }), task("c")], lunes10);
  assert.deepEqual(itemsOf(r).map((t) => t.taskId), ["c"]);
});

test("notBefore corre la tarea para más adelante (ej: 'No hoy')", () => {
  const manana = new Date(2026, 10, 10, 0, 0).toISOString();
  const r = plan(profile, [task("a", { notBefore: manana, minutes: 30 })], lunes10);
  const [t] = itemsOf(r);
  assert.ok(t.date >= "2026-11-10");
});

test("replanificar: lo que no se hizo se reacomoda sin perderse", () => {
  const tasks = [task("a", { minutes: 30, effort: "light" }), task("b", { minutes: 30, effort: "light" })];
  const antes = plan(profile, tasks, lunes10);
  const despues = plan(profile, tasks, new Date(2026, 10, 9, 22, 0)); // pasó el día
  assert.equal(itemsOf(antes).length, 2);
  assert.equal(itemsOf(despues).length + despues.unplaced.length, 2);
});

test("un check-in de energía baja aleja lo exigente de las próximas horas", () => {
  const now = new Date(2026, 10, 7, 9, 0);
  const normal = plan(profile, [task("x", { effort: "hard", minutes: 60 })], now);
  const cansada = plan(profile, [task("x", { effort: "hard", minutes: 60 })], now, {
    checkin: { energy: 1, at: now },
  });
  const [a] = itemsOf(normal);
  const [b] = itemsOf(cansada);
  assert.ok(b.date > a.date || b.start > a.start, "con poca energía lo exigente se corre");
});

test("es una función pura: no modifica sus entradas", () => {
  const tasks = [task("a", { minutes: 30 })];
  const snapshot = JSON.stringify({ profile, tasks });
  plan(profile, tasks, lunes10);
  assert.equal(JSON.stringify({ profile, tasks }), snapshot);
});

test("un compromiso puntual bloquea solo ese día y se identifica para poder editarlo", () => {
  const withCourse = {
    ...profile,
    oneOffBlocks: [{ id: "curso1", title: "Curso", date: "2026-11-11", start: "19:30", end: "22:00" }],
  };
  const tasks = Array.from({ length: 40 }, (_, i) => task(`t${i}`, { minutes: 30, effort: "light" }));
  const r = plan(withCourse, tasks, lunes8);
  const miercoles = r.days.find((d) => d.date === "2026-11-11");
  const curso = miercoles.items.find((i) => i.title === "Curso");
  assert.equal(curso.oneOffId, "curso1");
  for (const t of miercoles.items.filter((i) => i.type === "task")) {
    assert.ok(t.end <= curso.start || t.start >= curso.end, "ninguna tarea pisa el curso");
  }
  const jueves = r.days.find((d) => d.date === "2026-11-12");
  assert.ok(!jueves.items.some((i) => i.title === "Curso"));
});

test("una tarea corta no se infla: 10 minutos ocupan 10 minutos", () => {
  const r = plan(profile, [task("platos", { minutes: 10, effort: "light" })], lunes10);
  const [t] = itemsOf(r);
  assert.equal(t.end - t.start, 10);
});

test("una tarea con días elegidos solo se ubica en esos días", () => {
  const r = plan(profile, [task("b", { minutes: 30, effort: "medium", days: [6] })], lunes8);
  const dows = itemsOf(r).filter((i) => i.taskId === "b").map((i) => parseYMD(i.date).getDay());
  assert.deepEqual(dows, [6]);
});

test("una tarea de la mañana se ubica por la mañana si hay lugar", () => {
  const r = plan(profile, [task("m", { minutes: 30, effort: "light", part: "morning" })], lunes8);
  const it = itemsOf(r).find((i) => i.taskId === "m");
  assert.ok(it.start >= 300 && it.start < 780, `arrancó a los ${it.start} min`);
});

test("si no entra en su momento del día, la tarea igual se ubica", () => {
  const busy = { ...profile, fixedBlocks: [{ title: "Todo el día", kind: "work", days: [0, 1, 2, 3, 4, 5, 6], start: "05:00", end: "13:00" }] };
  const r = plan(busy, [task("m", { minutes: 30, effort: "light", part: "morning" })], lunes8);
  assert.equal(r.unplaced.length, 0);
  assert.ok(itemsOf(r).some((i) => i.taskId === "m"));
});
