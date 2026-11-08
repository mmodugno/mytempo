import test from "node:test";
import assert from "node:assert/strict";
import { upcomingReminders, dueReminders } from "../src/engine/reminders.js";
import { plan } from "../src/engine/planner.js";
import { DEFAULT_ENERGY } from "../src/engine/energy.js";

const profile = {
  wake: "08:30", sleep: "00:30", energy: DEFAULT_ENERGY, breakMinutes: 10,
  freeMinutes: { weekday: 120, weekend: 240 }, fixedBlocks: [], oneOffBlocks: [],
};
const sab9 = new Date(2026, 10, 7, 9, 0);
const tasks = [
  { id: "a", title: "Estudiar", minutes: 60, effort: "hard", status: "todo" },
  { id: "b", title: "Lavar", minutes: 30, effort: "light", status: "todo" },
];
const p = plan(profile, tasks, sab9);

test("genera un aviso por bloque de tarea, ordenado por hora", () => {
  const r = upcomingReminders(p, sab9, { withinMin: 24 * 60 });
  assert.ok(r.length >= 1);
  for (let i = 1; i < r.length; i++) assert.ok(r[i].at >= r[i - 1].at);
  assert.ok(r.every((x) => x.startsAt > sab9));
});

test("el aviso llega con la anticipación pedida", () => {
  const [first] = upcomingReminders(p, sab9, { lead: 10 });
  assert.equal(first.startsAt - first.at, 10 * 60000);
});

test("no incluye lo que ya empezó ni lo que queda fuera de la ventana", () => {
  const justAfterStart = upcomingReminders(p, sab9);
  const first = justAfterStart[0];
  const later = new Date(first.startsAt.getTime() + 1000);
  assert.ok(!upcomingReminders(p, later).some((r) => r.key === first.key));
  assert.equal(upcomingReminders(p, sab9, { withinMin: 1 }).length, 0);
});

test("las claves son únicas", () => {
  const r = upcomingReminders(p, sab9, { withinMin: 7 * 24 * 60 });
  assert.equal(new Set(r.map((x) => x.key)).size, r.length);
});

test("dueReminders devuelve el aviso solo cuando ya toca y no empezó", () => {
  const [first] = upcomingReminders(p, sab9);
  const antes = new Date(first.at.getTime() - 60000);
  const justo = new Date(first.at.getTime() + 30000);
  const tarde = new Date(first.startsAt.getTime() + 60000);
  assert.ok(!dueReminders(p, antes).some((r) => r.key === first.key));
  assert.ok(dueReminders(p, justo).some((r) => r.key === first.key));
  assert.ok(!dueReminders(p, tarde).some((r) => r.key === first.key));
});

test("dueReminders no repite lo ya avisado", () => {
  const [first] = upcomingReminders(p, sab9);
  const justo = new Date(first.at.getTime() + 30000);
  assert.equal(dueReminders(p, justo, new Set([first.key])).some((r) => r.key === first.key), false);
});

test("sin tareas no hay avisos", () => {
  assert.deepEqual(upcomingReminders(plan(profile, [], sab9), sab9), []);
});
