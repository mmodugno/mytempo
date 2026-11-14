// El perfil es todo lo que la app sabe de la persona. El motor solo lee este objeto:
// no hay nada personal escrito en el código.

import { DEFAULT_ENERGY } from "../engine/energy.js";
import { parseHM } from "../engine/time.js";

export const PROFILE_VERSION = 1;

export const BLOCK_KINDS = ["work", "study", "travel", "meal", "rest", "commitment"];

/** Perfil vacío con valores razonables, para quien arranca el onboarding desde cero. */
export function defaultProfile() {
  return {
    version: PROFILE_VERSION,
    name: "",
    wake: "08:00",
    sleep: "00:00",
    energy: structuredClone(DEFAULT_ENERGY),
    learn: true, // la curva se ajusta con los check-ins
    breakMinutes: 10,
    freeMinutes: { weekday: 120, weekend: 240 },
    fixedBlocks: [],
    oneOffBlocks: [],
    routine: [], // tareas de todos los días / de la semana que ya vienen cargadas
    petName: "Pompón",
    pet: { bought: [], worn: null, spent: 0 }, // vestidor: accesorios comprados, puestos y monedas gastadas
    streakRest: 1, // días de descanso por semana que no cortan la racha
  };
}

/** Devuelve una lista de problemas en español (vacía si el perfil es válido). */
export function validateProfile(p) {
  const errors = [];
  if (!p || typeof p !== "object") return ["El perfil está vacío."];

  const hm = (value, label) => {
    try {
      return parseHM(value);
    } catch {
      errors.push(`${label}: hora inválida (${value}).`);
      return null;
    }
  };

  hm(p.wake, "Hora de despertar");
  hm(p.sleep, "Hora de dormir");

  for (const key of ["weekday", "weekend"]) {
    const curve = p.energy?.[key];
    if (!Array.isArray(curve) || curve.length !== 24 || !curve.every((v) => Number.isFinite(v) && v >= 1 && v <= 5)) {
      errors.push(`La curva de energía (${key}) necesita 24 valores entre 1 y 5.`);
    }
  }

  if (!(p.breakMinutes >= 0)) errors.push("Las pausas deben ser 0 minutos o más.");
  for (const key of ["weekday", "weekend"]) {
    if (!(p.freeMinutes?.[key] >= 0)) errors.push(`El tiempo libre (${key}) debe ser 0 minutos o más.`);
  }

  // Cada lista tiene que ser una lista de objetos; si viene otra cosa lo decimos en vez de romper.
  const list = (value, label) => {
    if (value == null) return [];
    if (!Array.isArray(value) || value.some((x) => !x || typeof x !== "object")) {
      errors.push(`${label}: tiene un formato inválido.`);
      return [];
    }
    return value;
  };

  list(p.fixedBlocks, "Los horarios fijos").forEach((b, i) => {
    const label = `Bloque fijo ${i + 1}${b.title ? ` (${b.title})` : ""}`;
    if (!b.title) errors.push(`${label}: falta el nombre.`);
    if (!Array.isArray(b.days) || b.days.length === 0 || !b.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
      errors.push(`${label}: los días deben ser números de 0 (domingo) a 6 (sábado).`);
    }
    const s = hm(b.start, `${label}, inicio`);
    const e = hm(b.end, `${label}, fin`);
    if (s !== null && e !== null && e <= s) errors.push(`${label}: el fin debe ser después del inicio.`);
  });

  list(p.oneOffBlocks, "Los compromisos de un día").forEach((b, i) => {
    const label = `Bloque puntual ${i + 1}${b.title ? ` (${b.title})` : ""}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date ?? "")) errors.push(`${label}: fecha inválida.`);
    const s = hm(b.start, `${label}, inicio`);
    const e = hm(b.end, `${label}, fin`);
    if (s !== null && e !== null && e <= s) errors.push(`${label}: el fin debe ser después del inicio.`);
  });

  list(p.routine, "La rutina").forEach((r, i) => {
    const label = `Rutina ${i + 1}${r.title ? ` (${r.title})` : ""}`;
    if (!r.id || !r.title) errors.push(`${label}: falta el nombre.`);
    if (!(r.minutes >= 1)) errors.push(`${label}: la duración debe ser de 1 minuto o más.`);
  });
  if (p.streakRest != null && ![0, 1, 2].includes(p.streakRest)) errors.push("Los días de descanso por semana van de 0 a 2.");

  if (p.pet != null) {
    if (!Array.isArray(p.pet.bought) || !(p.pet.spent >= 0)) errors.push("El vestidor de la mascota está mal formado.");
    if (p.pet.worn != null && !Array.isArray(p.pet.worn)) errors.push("El vestidor de la mascota está mal formado.");
  }

  return errors;
}

let blockCounter = 0;
export function newBlockId() {
  blockCounter += 1;
  return `b${Date.now().toString(36)}${blockCounter}`;
}
