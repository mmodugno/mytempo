import { test } from "node:test";
import assert from "node:assert/strict";
import { ITEMS, newPet, coins, owns, wornItems, outfitFor, buy, toggleWear, phrase } from "../src/engine/pet.js";

test("los accesorios de racha se ganan con la mejor racha y se llevan puestos por defecto", () => {
  assert.equal(owns("bow", 2, newPet()), false);
  assert.equal(owns("bow", 3, newPet()), true);
  assert.deepEqual(wornItems(7, newPet()).sort(), ["bow", "scarf"]);
  assert.equal(outfitFor(3, null).bow, true);
  assert.equal(outfitFor(3, null).glasses, false);
});

test("comprar descuenta monedas, no baja el nivel y lo deja puesto", () => {
  const r = buy(newPet(), "glasses", 100, 0);
  assert.equal(r.ok, true);
  assert.equal(r.pet.spent, 60);
  assert.equal(coins(100, r.pet), 40);
  assert.deepEqual(wornItems(0, r.pet), ["glasses"]);
});

test("no se compra sin monedas, ni dos veces, ni algo que es de racha", () => {
  assert.deepEqual(buy(newPet(), "medal", 50, 0), { ok: false, reason: "faltan-monedas", missing: 70 });
  const once = buy(newPet(), "flower", 100, 0).pet;
  assert.equal(buy(once, "flower", 100, 0).reason, "ya-lo-tiene");
  assert.equal(buy(newPet(), "crown", 999, 0).reason, "no-se-vende");
});

test("en cada lugar hay un solo accesorio: la corona saca el gorrito y los auriculares", () => {
  const pet = { ...newPet(), bought: ["headphones"] };
  let p = toggleWear(pet, "headphones", 30);
  assert.deepEqual(wornItems(30, p).filter((x) => ["hat", "crown", "headphones"].includes(x)), ["headphones"]);
  p = toggleWear(p, "crown", 30);
  assert.deepEqual(wornItems(30, p).filter((x) => ["hat", "crown", "headphones"].includes(x)), ["crown"]);
  p = toggleWear(p, "crown", 30);
  assert.equal(wornItems(30, p).includes("crown"), false);
});

test("no se puede ponerse lo que no se tiene", () => {
  const p = toggleWear(newPet(), "scarf", 2);
  assert.deepEqual(wornItems(2, p), []);
});

test("la frase es estable en la misma hora, cambia con el contexto y nunca culpa", () => {
  const now = new Date(2026, 10, 9, 10, 5);
  assert.equal(phrase({ now, streak: 2, todayDone: false }), phrase({ now: new Date(2026, 10, 9, 10, 55), streak: 2, todayDone: false }));
  assert.ok(phrase({ now, streak: 2, todayDone: true }).length > 5);
  for (const awake of [true, false]) for (const streak of [0, 3, 9]) assert.ok(!/fallaste|perdiste|culpa de vos/i.test(phrase({ now, streak, todayDone: false, awake })));
  assert.equal(ITEMS.length, 10);
});
