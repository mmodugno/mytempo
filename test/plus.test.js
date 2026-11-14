import test from "node:test";
import assert from "node:assert/strict";
import { PLUS_FEATURES, EVENTS, buildPayload, bump, featureById } from "../src/engine/plus.js";
import { ITEMS, owns, wornItems, outfitFor, toggleWear, buy, newPet } from "../src/engine/pet.js";

test("los accesorios Plus solo se tienen con Plus, y no se compran con monedas", () => {
  assert.equal(owns("cape", 99, newPet(), false), false);
  assert.equal(owns("cape", 0, newPet(), true), true);
  assert.equal(buy(newPet(), "cape", 9999, 99, true).reason, "no-se-vende");
  assert.ok(ITEMS.filter((i) => i.plus).every((i) => i.cost == null && i.streak == null));
});

test("sin Plus no se pueden poner, y al perder Plus se sacan solos", () => {
  assert.deepEqual(toggleWear(newPet(), "chef", 0, false), newPet());
  let pet = toggleWear(newPet(), "chef", 0, true);
  assert.ok(wornItems(0, pet, true).includes("chef"));
  assert.equal(outfitFor(0, pet, true).chef, true);
  assert.equal(outfitFor(0, pet, false).chef, false, "sin Plus no se dibuja");
  assert.ok(!wornItems(0, pet, false).includes("chef"));
});

test("el gorro de chef comparte lugar con gorrito y corona (uno solo en la cabeza)", () => {
  const pet = toggleWear(newPet(), "chef", 30, true);
  const worn = wornItems(30, pet, true);
  assert.ok(worn.includes("chef") && !worn.includes("hat") && !worn.includes("crown"));
});

test("comprar algo mientras se tiene Plus no saca lo de Plus que se llevaba puesto", () => {
  const pet = toggleWear(newPet(), "cape", 0, true);
  const r = buy(pet, "flower", 500, 0, true);
  assert.ok(r.ok);
  assert.ok(r.pet.worn.includes("cape") && r.pet.worn.includes("flower"));
});

test("las métricas solo aceptan eventos conocidos y no llevan datos personales", () => {
  assert.equal(buildPayload("evento_inventado", {}, "2026-11-13"), null);
  assert.equal(buildPayload("tarea_escrita", { title: "Llamar a mamá" }, "2026-11-13"), null);
  const p = buildPayload("plus_lock_tap", { feature: "cape", from: "vestidor", title: "secreto", name: "Ana", id: "x" }, "2026-11-13");
  assert.deepEqual(p, { event: "plus_lock_tap", day: "2026-11-13", v: 1, feature: "cape", from: "vestidor" });
  assert.deepEqual(Object.keys(buildPayload("plus_open", {}, "2026-11-13")).sort(), ["day", "event", "v"]);
  for (const e of EVENTS) assert.ok(buildPayload(e, {}, "2026-11-13"));
});

test("valores libres en 'feature' y 'from' se descartan", () => {
  const p = buildPayload("plus_open", { feature: "<script>", from: "mi casa" }, "2026-11-13");
  assert.equal(p.feature, undefined);
  assert.equal(p.from, undefined);
});

test("los contadores suman por evento y por función", () => {
  let c = bump({}, "plus_lock_tap", "cape");
  c = bump(c, "plus_lock_tap", "cape");
  c = bump(c, "plus_open");
  assert.deepEqual(c, { "plus_lock_tap:cape": 2, plus_open: 1 });
});

test("la lista de Plus es coherente", () => {
  assert.ok(PLUS_FEATURES.length >= 3);
  assert.equal(new Set(PLUS_FEATURES.map((f) => f.id)).size, PLUS_FEATURES.length);
  assert.ok(PLUS_FEATURES.every((f) => f.label && f.hint));
  assert.equal(featureById("accessories").ready, true);
  assert.equal(featureById("nada"), null);
});
