// Curva de energía: un valor de 1 (muy baja) a 5 (muy alta) por cada hora del día.
// Hay una curva para días de semana y otra para fines de semana.

import { isWeekend, minutesOfDay } from "./time.js";

/** Punto de partida hasta que la app aprenda del uso real: cabeza clara a la mañana, cansancio a la noche. */
export const DEFAULT_ENERGY = {
  //            0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23
  weekday: [1, 1, 1, 1, 1, 1, 1, 2, 3, 5, 5, 5, 4, 3, 3, 4, 3, 3, 3, 2, 2, 2, 1, 1],
  weekend: [1, 1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 5, 4, 3, 3, 4, 4, 3, 3, 2, 2, 2, 1, 1],
};

/** Cuánto dura (en minutos) el efecto de un check-in reciente sobre la curva. */
export const CHECKIN_DECAY_MIN = 180;

export function curveFor(profile, date) {
  const energy = profile.energy ?? DEFAULT_ENERGY;
  return isWeekend(date) ? energy.weekend : energy.weekday;
}

/** Energía puntual en un minuto del día (0..1439+). */
export function energyAt(profile, date, minute) {
  const curve = curveFor(profile, date);
  const hour = Math.floor((((minute % 1440) + 1440) % 1440) / 60);
  return curve[hour];
}

/**
 * Energía en un minuto del día, interpolada suavemente entre los valores por hora
 * (el valor de cada hora vale en el centro de esa hora). Sirve para dibujar la curva.
 */
export function energyInterp(curve, minute) {
  const h = minute / 60 - 0.5;
  const i = Math.floor(h);
  const f = h - i;
  const at = (n) => curve[((n % 24) + 24) % 24];
  return at(i) * (1 - f) + at(i + 1) * f;
}

/**
 * Energía promedio entre [start, end) minutos del día, ponderada por minuto.
 * Si hay un check-in reciente, desplaza la curva y el efecto se va apagando solo.
 */
export function avgEnergy(profile, date, start, end, checkin = null) {
  const span = Math.max(1, end - start);
  let sum = 0;
  for (let m = start; m < end; m += 5) {
    const step = Math.min(5, end - m);
    let e = energyAt(profile, date, m);
    if (checkin) e += checkinShift(profile, date, m, checkin);
    sum += clamp(e, 1, 5) * step;
  }
  return sum / span;
}

/**
 * Cuánto se corre la curva en el minuto `m` de `date` por un check-in.
 * checkin = { energy: 1..5, at: Date }
 */
export function checkinShift(profile, date, m, checkin) {
  const at = checkin.at;
  const atMinute = minutesOfDay(at);
  const sameDay =
    at.getFullYear() === date.getFullYear() &&
    at.getMonth() === date.getMonth() &&
    at.getDate() === date.getDate();
  if (!sameDay) return 0;
  const elapsed = m - atMinute;
  if (elapsed < 0 || elapsed > CHECKIN_DECAY_MIN) return 0;
  const baseline = energyAt(profile, at, atMinute);
  const delta = checkin.energy - baseline;
  return delta * (1 - elapsed / CHECKIN_DECAY_MIN);
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}
