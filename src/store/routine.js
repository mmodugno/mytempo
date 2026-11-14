// Rutina diaria: tareas que ya vienen cargadas y se repiten. Viven en el perfil (se exportan
// e importan con él) y la app mantiene una tarea pendiente por cada una que esté activa.

export const ROUTINE_CATALOG = [
  { key: "platos", title: "Lavar los platos", minutes: 10, effort: "light", repeat: "day" },
  { key: "ordenar", title: "Ordenar un rato", minutes: 15, effort: "light", repeat: "day" },
  { key: "ejercicio", title: "Moverme / ejercicio", minutes: 30, effort: "medium", repeat: "day" },
  { key: "barrer", title: "Barrer la casa", minutes: 15, effort: "light", repeat: "day" },
  { key: "agua", title: "Llenar las botellas de agua", minutes: 5, effort: "light", repeat: "day" },
  { key: "bano", title: "Limpiar el baño", minutes: 30, effort: "medium", repeat: "week" },
  { key: "cama", title: "Tender la cama", minutes: 5, effort: "light", repeat: "day" },
  { key: "plantas", title: "Regar las plantas", minutes: 10, effort: "light", repeat: "week" },
  { key: "estudiar", title: "Estudiar un rato", minutes: 45, effort: "hard", repeat: "day" },
];

/** Ítem de rutina (activo) a partir de una entrada del catálogo. */
export const fromCatalog = (c) => ({ id: c.key, title: c.title, minutes: c.minutes, effort: c.effort, repeat: c.repeat, on: true });

let counter = 0;
export function newRoutineId() {
  counter += 1;
  return `r${Date.now().toString(36)}${counter}`;
}

/**
 * Deja las tareas de acuerdo con la rutina: crea la que falta y saca las pendientes de ítems
 * apagados o borrados. No toca lo que ya existe. Idempotente.
 * @returns {{tasks: object[], changed: boolean}}
 */
export function syncRoutine(routine, tasks, now, newId) {
  let changed = false;
  const byId = new Map((routine ?? []).map((r) => [r.id, r]));
  let out = tasks.filter((t) => {
    if (!t.routineId || t.status !== "todo") return true;
    const keep = byId.get(t.routineId)?.on;
    if (!keep) changed = true;
    return keep;
  });

  for (const r of routine ?? []) {
    if (!r.on) continue;
    const pending = out.filter((t) => t.routineId === r.id && t.status === "todo");
    if (pending.length === 0) {
      out.push({
        id: newId(),
        title: r.title,
        minutes: r.minutes,
        minutesAuto: false,
        effortAuto: false,
        due: null,
        priority: 2,
        effort: r.effort,
        repeat: r.repeat,
        days: r.days?.length ? [...r.days] : null,
        part: r.part ?? null,
        subtasks: [],
        status: "todo",
        routineId: r.id,
        createdAt: now.toISOString(),
      });
      changed = true;
    } else {
      // Lo que editaste en una tarea (duración, esfuerzo) se respeta: acá no se pisa nada.
      // Si por algún motivo quedaron repetidas, nos quedamos con una sola.
      if (pending.length > 1) {
        const extra = new Set(pending.slice(1).map((t) => t.id));
        out = out.filter((t) => !extra.has(t.id));
        changed = true;
      }
    }
  }
  return { tasks: out, changed };
}

/** Pasa los cambios de un ítem de rutina a su tarea pendiente (duración, repetición, días, momento). */
export function patchRoutineTasks(item, tasks) {
  for (const t of tasks) {
    if (t.routineId !== item.id || t.status !== "todo") continue;
    t.title = item.title;
    t.minutes = item.minutes;
    t.minutesAuto = false;
    t.effort = item.effort;
    t.repeat = item.repeat;
    t.days = item.days?.length ? [...item.days] : null;
    t.part = item.part ?? null;
  }
  return tasks;
}

export const PART_LABEL = { morning: "por la mañana", afternoon: "por la tarde", evening: "por la noche" };
