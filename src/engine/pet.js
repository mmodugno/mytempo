// Vestidor y frases de la mascota. Todo puro: la UI solo dibuja lo que esto decide.
//
// Dos formas de conseguir accesorios: los de racha se desbloquean solos al llegar a cierta cantidad
// de días seguidos; los de la tienda se compran con monedas (las monedas son los puntos ganados
// menos lo gastado; el nivel usa los puntos ganados, así que gastar nunca baja el nivel).

export const ITEMS = [
  { id: "bow", label: "Moñito", slot: "ear-right", streak: 3 },
  { id: "scarf", label: "Bufanda", slot: "neck", streak: 7 },
  { id: "hat", label: "Gorrito", slot: "head", streak: 14 },
  { id: "crown", label: "Corona", slot: "head", streak: 30 },
  { id: "flower", label: "Flor", slot: "ear-left", cost: 40 },
  { id: "glasses", label: "Gafas de sol", slot: "face", cost: 60 },
  { id: "headphones", label: "Auriculares", slot: "head", cost: 90 },
  { id: "medal", label: "Medalla", slot: "chest", cost: 120 },
];

const byId = (id) => ITEMS.find((i) => i.id === id);

export const newPet = () => ({ bought: [], worn: null, spent: 0 });

/** Monedas disponibles. */
export const coins = (totalPoints, pet) => Math.max(0, totalPoints - (pet?.spent ?? 0));

/** ¿Tiene este accesorio? (de racha: por haber llegado; de tienda: por haberlo comprado) */
export function owns(id, bestStreak, pet) {
  const it = byId(id);
  if (!it) return false;
  return it.streak != null ? bestStreak >= it.streak : (pet?.bought ?? []).includes(id);
}

/**
 * Qué lleva puesto. Mientras no elija nada ("worn" sin definir) lleva todo lo de racha que ganó,
 * como hasta ahora; en cuanto toca el vestidor, manda su elección.
 */
export function wornItems(bestStreak, pet) {
  const owned = ITEMS.filter((i) => owns(i.id, bestStreak, pet)).map((i) => i.id);
  const worn = pet?.worn ?? owned.filter((id) => byId(id).streak != null);
  return worn.filter((id) => owned.includes(id));
}

/** Banderas para dibujar. */
export function outfitFor(bestStreak, pet) {
  const worn = wornItems(bestStreak, pet);
  return Object.fromEntries(ITEMS.map((i) => [i.id, worn.includes(i.id)]));
}

/** Compra un accesorio de la tienda. Devuelve la mascota nueva o un motivo de rechazo. */
export function buy(pet, id, totalPoints, bestStreak) {
  const it = byId(id);
  if (!it || it.cost == null) return { ok: false, reason: "no-se-vende" };
  if (owns(id, bestStreak, pet)) return { ok: false, reason: "ya-lo-tiene" };
  if (coins(totalPoints, pet) < it.cost) return { ok: false, reason: "faltan-monedas", missing: it.cost - coins(totalPoints, pet) };
  const next = { ...newPet(), ...pet, bought: [...(pet?.bought ?? []), id], spent: (pet?.spent ?? 0) + it.cost };
  next.worn = wornItems(bestStreak, pet);
  next.worn = placeOn(next.worn, id);
  return { ok: true, pet: next };
}

/** Pone o saca un accesorio. En cada lugar (cabeza, cara…) hay uno solo: ponerse algo saca lo que había. */
export function toggleWear(pet, id, bestStreak) {
  if (!owns(id, bestStreak, pet)) return pet;
  const worn = wornItems(bestStreak, pet);
  const next = worn.includes(id) ? worn.filter((x) => x !== id) : placeOn(worn, id);
  return { ...newPet(), ...pet, worn: next };
}

function placeOn(worn, id) {
  const slot = byId(id).slot;
  return [...worn.filter((x) => byId(x).slot !== slot), id];
}

/* ---------- Frases ---------- */

const SAYINGS = {
  night: ["Hoy hiciste lo que pudiste. Descansá.", "Yo ya me estoy durmiendo. Mañana seguimos.", "Cerrá el día tranqui."],
  morning: ["Buen día. Con una tarea chiquita ya arrancamos.", "Mañana de cabeza clara: aprovechala.", "¿Empezamos por lo más liviano?"],
  afternoon: ["Dale, una cosita y seguimos.", "Tomate el tiempo que necesites.", "Un bloque y listo."],
  evening: ["Ya casi cerramos el día.", "Una última y a descansar.", "Lo que quede lo acomodo yo."],
  weekend: ["Finde: sin apuro.", "Hoy se puede ir más lento.", "Una cosita y el resto es tuyo."],
  done: ["Hoy ya cumpliste. Lo demás es de regalo.", "¡Día cumplido! Estoy contento.", "Ya está la racha de hoy."],
  streak: ["Qué racha llevás. ¡Seguila!", "Cada día suma, y vos venís sumando.", "Así se arman las rachas."],
  fresh: ["Hoy puede ser un buen día para arrancar.", "Con una tarea alcanza.", "Empezamos de nuevo, sin culpa."],
};

/** Frase para hoy: depende de la hora, del día y de cómo va la racha. Es estable dentro de la misma hora. */
export function phrase({ now, streak, todayDone, awake = true }) {
  const hour = now.getHours();
  const weekend = now.getDay() === 0 || now.getDay() === 6;
  const pool = !awake ? SAYINGS.night : todayDone ? SAYINGS.done : streak >= 5 ? SAYINGS.streak : streak === 0 && hour < 20 ? SAYINGS.fresh : weekend ? SAYINGS.weekend : hour < 12 ? SAYINGS.morning : hour < 19 ? SAYINGS.afternoon : SAYINGS.evening;
  const seed = Math.floor(now.getTime() / 3600000) + now.getDate();
  return pool[seed % pool.length];
}
