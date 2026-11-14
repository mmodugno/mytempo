// Pruebas de propiedades: muchos escenarios al azar (con semilla) y reglas que el plan SIEMPRE tiene que cumplir.

import test from "node:test";
import assert from "node:assert/strict";
import { plan, MAX_CHUNK, remainingMinutes } from "../src/engine/planner.js";
import { DEFAULT_ENERGY } from "../src/engine/energy.js";
import { ymd, addDays, startOfDay, parseHM } from "../src/engine/time.js";
import { rng, hmStr } from "./helpers.js";

const EFFORTS = ["light", "medium", "hard"];
const PARTS = [undefined, "morning", "afternoon", "evening"];

function scenario(seed) {
  const r = rng(seed);
  const wake = r.int(5, 10) * 60 + r.pick([0, 30]);
  const sleepH = r.pick([22, 23, 24, 25]); // 25 = 01:00 del día siguiente
  const sleep = (sleepH * 60) % 1440;
  const fixedBlocks = Array.from({ length: r.int(0, 4) }, () => {
    const start = r.int(wake / 30 + 1, 34) * 30; // hasta 17:00
    const end = Math.min(start + r.int(1, 6) * 30, 22 * 60);
    return { title: "Bloque", kind: r.pick(["work", "study", "travel", "meal"]), days: Array.from({ length: r.int(1, 5) }, () => r.int(0, 6)), start: hmStr(start), end: hmStr(end) };
  });
  const profile = {
    wake: hmStr(wake),
    sleep: hmStr(sleep),
    energy: DEFAULT_ENERGY,
    breakMinutes: r.pick([0, 5, 10, 15]),
    freeMinutes: { weekday: r.pick([0, 60, 120, 180]), weekend: r.pick([0, 120, 240]) },
    fixedBlocks,
    oneOffBlocks: [],
  };
  const now = new Date(2026, 10, r.int(1, 28), r.int(0, 23), r.pick([0, 7, 15, 40]));
  const tasks = Array.from({ length: r.int(0, 14) }, (_, i) => ({
    id: `t${i}`,
    title: `Tarea ${i}`,
    status: r.chance(0.1) ? "done" : "todo",
    minutes: r.chance(0.8) ? r.pick([5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240]) : undefined,
    effort: r.chance(0.8) ? r.pick(EFFORTS) : undefined,
    priority: r.chance(0.3) ? r.pick(["high", "low"]) : undefined,
    part: r.chance(0.2) ? r.pick(PARTS.slice(1)) : undefined,
    days: r.chance(0.15) ? [r.int(0, 6), r.int(0, 6)] : undefined,
    due: r.chance(0.25) ? ymd(addDays(startOfDay(now), r.int(0, 6))) : undefined,
    doneMinutes: r.chance(0.1) ? r.pick([5, 10]) : undefined,
  }));
  return { profile, tasks, now };
}

const overlap = (a, b) => a.start < b.end && b.start < a.end;

test("200 escenarios al azar: el plan siempre es coherente", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const { profile, tasks, now } = scenario(seed);
    const label = `semilla ${seed}`;
    const result = plan(profile, tasks, now, { days: 7 });
    const byId = new Map(tasks.map((t) => [t.id, t]));
    const wakeMin = parseHM(profile.wake);
    const sleepMin = parseHM(profile.sleep) <= wakeMin ? parseHM(profile.sleep) + 1440 : parseHM(profile.sleep); // acostarse pasada la medianoche cuenta como el mismo día
    const placed = new Map();

    for (const day of result.days) {
      const items = day.items;
      for (const it of items) {
        assert.ok(it.start >= 0 && it.end <= 2880 && it.end > it.start, `${label}: horario inválido ${JSON.stringify(it)}`);
      }
      // nada se pisa (salvo bloques fijos entre sí, que la persona puede haber superpuesto)
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          if (items[i].type === "fixed" && items[j].type === "fixed") continue;
          assert.ok(!overlap(items[i], items[j]), `${label}: se pisan ${items[i].title} y ${items[j].title} el ${day.date}`);
        }
      }
      for (const it of items.filter((i) => i.type === "task")) {
        const t = byId.get(it.taskId);
        assert.ok(t, `${label}: tarea desconocida`);
        assert.notEqual(t.status, "done", `${label}: planificó una tarea hecha`);
        assert.ok(it.start >= wakeMin && it.end <= sleepMin, `${label}: tarea fuera de la vigilia (${it.start}-${it.end}, vigilia ${wakeMin}-${sleepMin})`);
        assert.ok(it.end - it.start <= MAX_CHUNK, `${label}: bloque de más de ${MAX_CHUNK} min`);
        if (t.days?.length) {
          const dow = new Date(`${day.date}T12:00:00`).getDay();
          assert.ok(t.days.includes(dow), `${label}: ${t.id} en un día no permitido`);
        }
        placed.set(it.taskId, (placed.get(it.taskId) ?? 0) + (it.end - it.start));
      }
    }

    // nunca se agenda más tiempo del que falta
    for (const [id, minutes] of placed) {
      assert.ok(minutes <= remainingMinutes(byId.get(id)) + 14, `${label}: ${id} tiene ${minutes} min y le faltan ${remainingMinutes(byId.get(id))}`);
    }
    // hoy nada queda en el pasado
    const today = result.days[0];
    const nowMin = now.getHours() * 60 + now.getMinutes();
    for (const it of today.items.filter((i) => i.type === "task")) assert.ok(it.start >= nowMin - 14, `${label}: tarea en el pasado (${it.start} < ${nowMin})`);

    // determinista: mismos datos, mismo plan
    assert.deepEqual(plan(profile, tasks, now, { days: 7 }), result, `${label}: no es determinista`);
  }
});

test("no modifica los datos que recibe", () => {
  const { profile, tasks, now } = scenario(7);
  const before = JSON.stringify([profile, tasks]);
  plan(profile, tasks, now, { days: 7 });
  assert.equal(JSON.stringify([profile, tasks]), before);
});

test("con tiempo de sobra, una tarea que entra siempre se ubica", () => {
  for (let seed = 300; seed < 340; seed++) {
    const r = rng(seed);
    const profile = { wake: "08:00", sleep: "23:30", energy: DEFAULT_ENERGY, breakMinutes: 10, freeMinutes: { weekday: 60, weekend: 60 }, fixedBlocks: [], oneOffBlocks: [] };
    const now = new Date(2026, 10, r.int(1, 28), 7, 0);
    const result = plan(profile, [{ id: "a", title: "Una", status: "todo", minutes: r.pick([10, 30, 60]), effort: r.pick(EFFORTS) }], now, { days: 3 });
    assert.equal(result.unplaced.length, 0, `semilla ${seed}`);
  }
});
