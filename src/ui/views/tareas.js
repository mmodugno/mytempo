// Todas las tareas, con el momento en que quedaron planificadas.

import { h, hm, dur, shortDate, EFFORT_LABEL } from "../dom.js";
import { app, getPlan, undoTask } from "../state.js";
import { openTaskSheet } from "./tasksheet.js";

let showDone = false;
let rerender = () => {};
export const onTareasChange = (fn) => (rerender = fn);

export function renderTareas() {
  const plan = getPlan();
  const where = new Map(); // taskId -> primer bloque planificado
  for (const day of plan.days) {
    for (const it of day.items) if (it.type === "task" && !where.has(it.taskId)) where.set(it.taskId, { date: day.date, ...it });
  }
  const unplaced = new Set(plan.unplaced.map((u) => u.taskId));

  const pending = app.tasks
    .filter((t) => t.status === "todo")
    .sort((a, b) => {
      const wa = where.get(a.id);
      const wb = where.get(b.id);
      if (wa && wb) return wa.date === wb.date ? wa.start - wb.start : wa.date < wb.date ? -1 : 1;
      return wa ? -1 : wb ? 1 : 0;
    });
  const done = app.tasks.filter((t) => t.status === "done").sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""));

  const root = h("div");
  if (!pending.length) {
    root.append(h("div", { class: "empty" }, h("b", null, "Todo al día."), "Escribí una tarea abajo, por ejemplo: ", h("i", null, "Lavar la ropa 30m mañana"), "."));
  } else {
    root.append(h("div", { class: "eyebrow" }, `Pendientes · ${pending.length}`));
    pending.forEach((t) => root.append(taskRow(t, where.get(t.id), unplaced.has(t.id))));
  }

  if (done.length) {
    root.append(
      h("div", { class: "eyebrow" }, h("button", { class: "btn quiet", style: "min-height:36px;padding:0 12px;font-size:13px", onclick: () => ((showDone = !showDone), rerender()) }, `${showDone ? "Ocultar" : "Ver"} hechas (${done.length})`))
    );
    if (showDone) done.slice(0, 30).forEach((t) => root.append(doneRow(t)));
  }
  return root;
}

function taskRow(t, slot, noRoom) {
  const when = slot ? `${shortDate(slot.date).split(" ")[0]} ${hm(slot.start)}` : "—";
  const bits = [dur(t.minutes), EFFORT_LABEL[t.effort], t.due ? `vence ${shortDate(t.due)}` : null, noRoom ? "sin lugar por ahora" : null].filter(Boolean);
  return h(
    "button",
    { class: "row", onclick: () => openTaskSheet(t) },
    h("span", { class: "when" }, when),
    h("span", { class: "what" }, h("b", null, h("span", { class: `dot ${t.effort}` }), t.title), h("span", { class: "sub" }, bits.join(" · ")))
  );
}

function doneRow(t) {
  return h(
    "div",
    { class: "row fixed" },
    h("span", { class: "when" }, "✓"),
    h("span", { class: "what" }, h("b", null, t.title)),
    h("button", { class: "btn quiet", style: "min-height:34px;padding:0 10px;font-size:13px", onclick: () => undoTask(t.id) }, "Deshacer")
  );
}
