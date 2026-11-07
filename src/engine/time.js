// Utilidades de tiempo. Todo se maneja en hora local del dispositivo.
// Los horarios dentro de un día se expresan en minutos desde las 00:00
// (pueden pasar de 1440 si el día termina después de medianoche).

export const MIN_PER_DAY = 1440;

/** "08:30" -> 510 */
export function parseHM(str) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(str).trim());
  if (!m) throw new Error(`Hora inválida: "${str}"`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) throw new Error(`Hora inválida: "${str}"`);
  return h * 60 + min;
}

/** 510 -> "08:30" (los minutos pasados de 1440 vuelven a empezar el día) */
export function formatHM(minutes) {
  const m = ((Math.round(minutes) % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY;
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Date -> "2026-11-09" (fecha local) */
export function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** "2026-11-09" -> Date a las 00:00 locales */
export function parseYMD(str) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(str));
  if (!m) throw new Error(`Fecha inválida: "${str}"`);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

/** Minutos desde las 00:00 del día de `date` */
export function minutesOfDay(date) {
  return date.getHours() * 60 + date.getMinutes();
}

/** 0 = domingo ... 6 = sábado */
export function isWeekend(date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}

/** Redondea hacia arriba al múltiplo de `step` */
export function ceilTo(value, step) {
  return Math.ceil(value / step) * step;
}

/** Diferencia en días enteros entre dos fechas (b - a), ignorando la hora */
export function diffDays(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}
