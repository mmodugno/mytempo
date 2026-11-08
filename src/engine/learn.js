// Aprendizaje de energía: mezcla la curva que la persona declaró (lo que cree de sí misma)
// con lo que dicen sus check-ins reales. Con pocos datos manda la curva declarada;
// con más datos manda la observada. Los check-ins viejos pesan cada vez menos.

import { isWeekend, startOfDay, diffDays } from "./time.js";

export const PRIOR_WEIGHT = 4; // la curva declarada equivale a 4 observaciones
export const FOCUS_WEIGHT = 0.3; // cuánto pesa el foco frente a la energía, si se registró
export const HALF_LIFE_DAYS = 28; // un check-in de hace 4 semanas pesa la mitad
export const SPREAD = 0.5; // una observación también informa (a medias) las horas vecinas

/** Valor de un check-in: energía, mezclada con foco si existe. */
export function checkinValue(c) {
  return c.focus ? c.energy * (1 - FOCUS_WEIGHT) + c.focus * FOCUS_WEIGHT : c.energy;
}

/**
 * @param {{weekday:number[], weekend:number[]}} prior  Curva declarada
 * @param {Array<{energy:number, focus?:number|null, at:string}>} checkins
 * @param {Date} now
 * @returns {{ energy: {weekday:number[], weekend:number[]}, samples: {weekday:number[], weekend:number[]} }}
 */
export function learnCurve(prior, checkins, now = new Date()) {
  const sums = { weekday: Array(24).fill(0), weekend: Array(24).fill(0) };
  const weights = { weekday: Array(24).fill(0), weekend: Array(24).fill(0) };
  const today = startOfDay(now);

  for (const c of checkins) {
    const at = new Date(c.at);
    if (Number.isNaN(at.getTime()) || !(c.energy >= 1 && c.energy <= 5)) continue;
    const age = Math.max(0, diffDays(at, today));
    const decay = Math.pow(0.5, age / HALF_LIFE_DAYS);
    const kind = isWeekend(at) ? "weekend" : "weekday";
    const hour = at.getHours();
    const value = checkinValue(c);
    for (const [offset, w] of [[0, 1], [-1, SPREAD], [1, SPREAD]]) {
      const h = (hour + offset + 24) % 24;
      sums[kind][h] += value * w * decay;
      weights[kind][h] += w * decay;
    }
  }

  const blend = (kind) =>
    prior[kind].map((p, h) => {
      const w = weights[kind][h];
      return Math.round(((p * PRIOR_WEIGHT + sums[kind][h]) / (PRIOR_WEIGHT + w)) * 100) / 100;
    });

  return {
    energy: { weekday: blend("weekday"), weekend: blend("weekend") },
    samples: {
      weekday: weights.weekday.map((w) => Math.round(w * 100) / 100),
      weekend: weights.weekend.map((w) => Math.round(w * 100) / 100),
    },
  };
}

/** Perfil con la curva efectiva (declarada + aprendida). Si la persona apagó el aprendizaje, queda igual. */
export function effectiveProfile(profile, checkins, now = new Date()) {
  if (profile.learn === false || !checkins?.length) return profile;
  return { ...profile, energy: learnCurve(profile.energy, checkins, now).energy };
}
