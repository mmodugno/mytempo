// Estimación de duración y esfuerzo cuando la persona no los indica.
// Orden de confianza: 1) lo que ella misma cargó o midió en tareas parecidas, 2) palabras clave, 3) un valor por esfuerzo.

const STOP = new Set(["para", "con", "los", "las", "del", "una", "uno", "que", "por", "mis", "mi", "hay", "hacer", "todo", "toda"]);

// [raíz de la palabra, minutos típicos, esfuerzo]. Los objetos (platos, ropa) van antes que los verbos (lavar):
// si empatan en especificidad, gana el primero.
const KEYWORDS = [
  ["estudi", 90, "hard"], ["inform", 90, "hard"], ["examen", 90, "hard"], ["parcial", 90, "hard"], ["tesis", 90, "hard"],
  ["program", 90, "hard"], ["redact", 60, "hard"], ["escrib", 60, "hard"], ["presentaci", 90, "hard"], ["resum", 60, "hard"],
  ["curso", 90, "hard"], ["clase", 60, "hard"], ["tp", 90, "hard"], ["trabajo", 90, "hard"], ["leer", 45, "medium"], ["lectur", 45, "medium"],
  ["limpi", 60, "medium"], ["ordenar", 45, "medium"], ["orden", 45, "medium"], ["cocin", 60, "medium"], ["super", 60, "medium"],
  ["compras", 60, "medium"], ["tramit", 45, "medium"], ["reuni", 60, "medium"], ["entren", 60, "medium"], ["ejercicio", 45, "medium"],
  ["vajilla", 10, "light"], ["plato", 10, "light"], ["ropa", 30, "light"], ["lavar", 30, "light"], ["regar", 10, "light"],
  ["basura", 10, "light"], ["llamar", 15, "light"], ["llama", 15, "light"], ["pagar", 15, "light"], ["mail", 15, "light"],
  ["correo", 15, "light"], ["turno", 15, "light"], ["comprar", 30, "light"], ["tender", 15, "light"], ["doblar", 20, "light"],
];

const DEFAULT_BY_EFFORT = { light: 20, medium: 45, hard: 90 };

export const words = (title) =>
  title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));

const round5 = (n) => Math.max(5, Math.round(n / 5) * 5);

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function similarity(a, b) {
  const A = new Set(a);
  const B = new Set(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}

/**
 * @param {string} title
 * @param {Array} tasks  historial: se usan las que tienen duración cargada a mano o medida
 * @returns {{ minutes: number, effort: string, source: "history"|"keyword"|"default" }}
 */
export function estimate(title, tasks = []) {
  const w = words(title);

  // 1) Lo que ella ya cargó o midió en tareas parecidas
  const similar = tasks
    .filter((t) => (t.actualMinutes || (t.minutes && t.minutesAuto === false)) && similarity(w, words(t.title)) >= 0.5)
    .slice(-8);
  if (similar.length) {
    const minutes = round5(median(similar.map((t) => t.actualMinutes ?? t.minutes)));
    const efforts = similar.map((t) => t.effort).filter(Boolean);
    const effort = efforts.length ? efforts[efforts.length - 1] : keywordHit(w)?.[2] ?? "medium";
    return { minutes, effort, source: "history" };
  }

  // 2) Palabras clave
  const hit = keywordHit(w);
  if (hit) return { minutes: hit[1], effort: hit[2], source: "keyword" };

  // 3) Valor por defecto
  return { minutes: DEFAULT_BY_EFFORT.medium, effort: "medium", source: "default" };
}

function keywordHit(ws) {
  // Gana la palabra clave más específica (raíz más larga) que aparezca como comienzo de alguna palabra.
  let best = null;
  for (const entry of KEYWORDS) {
    if (ws.some((x) => x === entry[0] || (entry[0].length >= 4 && x.startsWith(entry[0])))) {
      if (!best || entry[0].length > best[0].length) best = entry;
    }
  }
  return best;
}

/** Para ajustar según cómo le fue a la persona: "menos", "previsto" o "mas". */
export const DURATION_FACTOR = { menos: 0.5, previsto: 1, mas: 1.5 };
export const actualFrom = (minutes, answer) => round5(minutes * DURATION_FACTOR[answer]);
