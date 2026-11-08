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

  (p.fixedBlocks ?? []).forEach((b, i) => {
    const label = `Bloque fijo ${i + 1}${b.title ? ` (${b.title})` : ""}`;
    if (!b.title) errors.push(`${label}: falta el nombre.`);
    if (!Array.isArray(b.days) || b.days.length === 0 || !b.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)) {
      errors.push(`${label}: los días deben ser números de 0 (domingo) a 6 (sábado).`);
    }
    const s = hm(b.start, `${label}, inicio`);
    const e = hm(b.end, `${label}, fin`);
    if (s !== null && e !== null && e <= s) errors.push(`${label}: el fin debe ser después del inicio.`);
  });

  (p.oneOffBlocks ?? []).forEach((b, i) => {
    const label = `Bloque puntual ${i + 1}${b.title ? ` (${b.title})` : ""}`;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date ?? "")) errors.push(`${label}: fecha inválida.`);
    const s = hm(b.start, `${label}, inicio`);
    const e = hm(b.end, `${label}, fin`);
    if (s !== null && e !== null && e <= s) errors.push(`${label}: el fin debe ser después del inicio.`);
  });

  return errors;
}

let blockCounter = 0;
export function newBlockId() {
  blockCounter += 1;
  return `b${Date.now().toString(36)}${blockCounter}`;
}
