// mytempo Plus: qué incluye y reglas de las métricas. Todo puro y sin navegador, para poder probarlo.

/** Lo que ofrece Plus. `ready` = ya existe en la app; el resto se muestra como "próximamente". */
export const PLUS_FEATURES = [
  { id: "accessories", label: "Más accesorios para Pompón", hint: "Capa, gorro de chef y los que vengan", ready: true },
  { id: "best-hours", label: "Tus mejores horas", hint: "Cuándo rendís más, mirando los últimos 3 meses", ready: false },
  { id: "widget", label: "Widget en la pantalla de inicio", hint: "Tu próxima tarea sin abrir la app", ready: false },
  { id: "calendar", label: "Importar desde tu calendario", hint: "Tus horarios fijos, sin cargarlos a mano", ready: false },
];

export const featureById = (id) => PLUS_FEATURES.find((f) => f.id === id) ?? null;

/* ---------- Métricas anónimas ---------- */

/** Únicos eventos que existen. Nada más se cuenta ni se envía. */
export const EVENTS = ["plus_open", "plus_lock_tap", "plus_interest", "plus_demo_on"];

/** Valores permitidos para "dónde" ocurrió (evita que se cuele texto libre). */
const FROM = ["ajustes", "vestidor", "resumen"];

/**
 * Arma lo que se enviaría: solo el nombre del evento, la función tocada y el día.
 * Sin identificadores, sin texto escrito por la persona, sin tareas ni horarios.
 * @returns {{event: string, feature?: string, from?: string, day: string, v: 1}|null} null si el evento no existe
 */
export function buildPayload(event, { feature, from } = {}, day) {
  if (!EVENTS.includes(event)) return null;
  const out = { event, day, v: 1 };
  if (feature && (featureById(feature) || ["cape", "chef"].includes(feature))) out.feature = feature;
  if (from && FROM.includes(from)) out.from = from;
  return out;
}

/** Suma uno al contador local de ese evento (y de esa función). */
export function bump(counts = {}, event, feature) {
  const key = feature ? `${event}:${feature}` : event;
  return { ...counts, [key]: (counts[key] ?? 0) + 1 };
}
