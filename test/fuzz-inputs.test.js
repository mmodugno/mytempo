// Entradas hostiles o raras: nada de lo que escriba, dicte, importe o tenga guardado la persona puede romper la app.

import test from "node:test";
import assert from "node:assert/strict";
import { parseQuickTask } from "../src/engine/parse.js";
import { validateProfile, defaultProfile } from "../src/store/profile.js";
import { createStore, memoryBackend } from "../src/store/storage.js";
import { nextOccurrence } from "../src/engine/repeat.js";
import { streakStats } from "../src/engine/streak.js";
import { estimate } from "../src/engine/estimate.js";
import { rng } from "./helpers.js";

const NOW = new Date(2026, 10, 9, 10, 0);
const WEIRD = ["", " ", "   \n\t", "😀🐶", "<script>alert(1)</script>", "'; DROP TABLE tareas;--", "a".repeat(5000), "00:00 25:99 99m #xyz cada nunca", "mañana mañana mañana", "30m 45m 60m", "\u0000​", "{{constructor}}", "__proto__", "cada 0 días", "el 32 de febrero", "-5m", "1e9m", "NaN", "undefined", "null"];

test("el parser de carga rápida nunca tira error y siempre devuelve un título de texto", () => {
  const r = rng(42);
  const chars = "abcdefghijklmnñopqrstuvwxyz áéíóú0123456789#:/-_.,;!?¿¡()[]{}<>+*&%$\\\"'`~|@ \n\t";
  const inputs = [...WEIRD];
  for (let i = 0; i < 500; i++) inputs.push(Array.from({ length: r.int(0, 60) }, () => chars[r.int(0, chars.length - 1)]).join(""));
  for (const text of inputs) {
    const out = parseQuickTask(text, NOW);
    assert.equal(typeof out.title, "string", JSON.stringify(text));
    if (out.minutes != null) assert.ok(Number.isFinite(out.minutes) && out.minutes > 0 && out.minutes <= 24 * 60, `minutos raros: ${out.minutes} en ${JSON.stringify(text.slice(0, 40))}`);
  }
});

test("el parser entiende lo normal aunque haya ruido alrededor", () => {
  assert.equal(parseQuickTask("   Lavar la ropa   30m   ", NOW).title, "Lavar la ropa");
  assert.equal(parseQuickTask("lavar la ropa 30m", NOW).minutes, 30);
  assert.equal(parseQuickTask("comprar pan #liviana", NOW).effort, "light");
});

test("validateProfile no explota con datos basura y devuelve mensajes", () => {
  const junk = [null, undefined, 0, "x", [], {}, { wake: 5 }, { wake: "25:00" }, { wake: "08:00", sleep: "00:00", energy: null }, { wake: "08:00", sleep: "00:00", fixedBlocks: "no" }, { ...defaultProfile(), routine: [{}] }, { ...defaultProfile(), pet: { bought: "x" } }, { ...defaultProfile(), streakRest: 9 }];
  for (const p of junk) {
    let out;
    assert.doesNotThrow(() => (out = validateProfile(p)));
    assert.ok(Array.isArray(out));
  }
  assert.ok(validateProfile(null).length > 0);
  assert.deepEqual(validateProfile(defaultProfile()).filter((e) => /pet|rutina|descanso/i.test(e)), []);
});

test("importar: JSON roto, vacío o con forma rara da un error claro y no toca lo que había", () => {
  const store = createStore(memoryBackend());
  const good = defaultProfile();
  good.name = "Antes";
  store.saveProfile(good);
  for (const bad of ["", "no es json", "[]", "{}", '{"profile":null}', '{"wake":"99:99"}', "null", "123", '{"profile":{"wake":"08:00"}}']) {
    assert.throws(() => store.importAll(bad), Error, bad);
    assert.equal(store.getProfile().name, "Antes", `se pisó el perfil con ${bad}`);
  }
});

test("datos guardados corruptos no rompen el arranque", () => {
  const backend = memoryBackend();
  backend.setItem("mytempo.profile", "{rota");
  backend.setItem("mytempo.tasks", "xx");
  backend.setItem("mytempo.checkins", "[1,");
  const store = createStore(backend);
  assert.ok(store.getProfile().wake);
  assert.deepEqual(store.getTasks(), []);
  assert.deepEqual(store.getCheckins(), []);
});

test("exportar e importar es un viaje de ida y vuelta sin pérdidas", () => {
  const a = createStore(memoryBackend());
  const p = defaultProfile();
  p.name = "Ida y vuelta";
  p.routine = [{ id: "r1", title: "Platos", minutes: 10, effort: "light", repeat: "daily", on: true }];
  p.pet = { bought: ["flower"], worn: ["flower"], spent: 40 };
  a.saveProfile(p);
  a.saveTasks([{ id: "t1", title: "Hola", status: "todo", subtasks: [{ id: "s", title: "uno", done: false }] }]);
  a.addCheckin({ energy: 4, focus: 3, at: NOW });
  const b = createStore(memoryBackend());
  b.importAll(a.exportAll());
  assert.deepEqual(b.getProfile(), a.getProfile());
  assert.deepEqual(b.getTasks(), a.getTasks());
  assert.deepEqual(b.getCheckins(), a.getCheckins());
});

test("un perfil viejo (sin rutina, mascota ni descanso) se importa y sigue siendo válido", () => {
  const old = defaultProfile();
  delete old.routine;
  delete old.pet;
  delete old.petName;
  delete old.streakRest;
  const store = createStore(memoryBackend());
  assert.doesNotThrow(() => store.importAll(JSON.stringify(old)));
});

test("los check-ins se acotan a 500", () => {
  const store = createStore(memoryBackend());
  for (let i = 0; i < 520; i++) store.addCheckin({ energy: 3, at: new Date(2026, 0, 1, 0, i) });
  assert.equal(store.getCheckins().length, 500);
});

test("nextOccurrence y streakStats toleran tareas incompletas", () => {
  const r = rng(9);
  const repeats = [null, undefined, "daily", "weekly", "2weeks", "monthly", "raro"];
  for (let i = 0; i < 300; i++) {
    const t = { id: "x", title: "t", status: "done", repeat: r.pick(repeats), days: r.chance(0.3) ? [r.int(0, 6)] : undefined, due: r.chance(0.3) ? "2026-11-20" : undefined, subtasks: r.chance(0.3) ? [{ id: "s", title: "a", done: true }] : undefined };
    const at = new Date(2026, r.int(0, 11), r.int(1, 28), r.int(0, 23));
    assert.doesNotThrow(() => nextOccurrence(t, at));
  }
  const messy = [{ id: "1", status: "done" }, { id: "2", status: "done", doneAt: "no es fecha" }, { id: "3", status: "todo" }, { id: "4", status: "done", doneAt: new Date(2026, 10, 8).toISOString(), minutes: -5, effort: "???" }, { id: "5", status: "done", doneAt: new Date(2026, 10, 8).toISOString(), partials: [{ at: "x", minutes: "y" }] }];
  let s;
  assert.doesNotThrow(() => (s = streakStats(messy, NOW)));
  assert.ok(Number.isFinite(s.total) && s.total >= 0 && s.current >= 0);
});

test("estimate siempre da minutos razonables", () => {
  for (const title of WEIRD) {
    const e = estimate(title, []);
    assert.ok(e.minutes >= 5 && e.minutes <= 480, `${JSON.stringify(title.slice(0, 20))} → ${e.minutes}`);
  }
});
