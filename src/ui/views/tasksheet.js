// Hoja para crear o editar una tarea con todos sus datos (todos opcionales menos el título).

import { h, clear, EFFORT_LABEL } from "../dom.js";
import { openSheet, closeSheet, toast } from "../components.js";
import { REPEAT_LABEL } from "../../engine/repeat.js";
import { app, addTask, updateTask, removeTask } from "../state.js";
import { estimate } from "../../engine/estimate.js";

const MINUTES = [5, 10, 15, 30, 45, 60, 90, 120, 180];
const PRIORITIES = [
  [1, "Baja"],
  [2, "Normal"],
  [3, "Alta"],
];

export function openTaskSheet(task, draft = {}) {
  const t = { title: "", minutes: 30, effort: "medium", priority: 2, due: null, repeat: null, ...draft, ...(task ?? {}) };
  t.subtasks = structuredClone(t.subtasks ?? []);

  // Tarea nueva sin duración/esfuerzo indicados: arrancamos con una estimación (y se puede ajustar).
  let minutesAuto = task ? task.minutesAuto === true : draft.minutes == null;
  let effortAuto = task ? task.effortAuto === true : draft.effort == null;
  const reestimate = () => {
    const e = estimate(title.value.trim() || t.title, app.tasks);
    if (minutesAuto) t.minutes = e.minutes;
    if (effortAuto) t.effort = e.effort;
  };
  const title = h("input", { type: "text", value: t.title, placeholder: "¿Qué hay que hacer?", maxLength: 120, onchange: () => (reestimate(), draw()) });
  const due = h("input", { type: "date", value: t.due ?? "" });
  const minutesChips = h("div", { class: "chips" });
  const effortChips = h("div", { class: "chips" });
  const prioChips = h("div", { class: "chips" });
  const repeatChips = h("div", { class: "chips" });
  const minutesNote = h("span", { class: "muted" });
  const subList = h("div");
  const subInput = h("input", { type: "text", placeholder: "Agregar un paso…", maxLength: 80, "aria-label": "Nuevo paso" });
  const error = h("p", { class: "small", style: "color:var(--accent);min-height:1.2em", role: "alert" });

  const drawSubs = () => {
    clear(subList);
    t.subtasks.forEach((s) =>
      subList.append(
        h(
          "div",
          { class: "sub-row" },
          h("button", { class: `check ${s.done ? "on" : ""}`, "aria-label": s.done ? "Destildar paso" : "Tildar paso", onclick: () => ((s.done = !s.done), drawSubs()) }, s.done ? "✓" : ""),
          h("span", { class: s.done ? "done" : "" }, s.title),
          h("button", { class: "x", "aria-label": "Quitar paso", onclick: () => ((t.subtasks = t.subtasks.filter((x) => x !== s)), drawSubs()) }, "×")
        )
      )
    );
  };
  const addSub = () => {
    const v = subInput.value.trim();
    if (!v) return;
    t.subtasks.push({ id: Math.random().toString(36).slice(2, 8), title: v, done: false });
    subInput.value = "";
    drawSubs();
    subInput.focus();
  };
  subInput.addEventListener("keydown", (e) => e.key === "Enter" && (e.preventDefault(), addSub()));
  drawSubs();

  const draw = () => {
    clear(repeatChips);
    minutesNote.textContent = minutesAuto ? " · estimada, tocá para ajustar" : "";
    [[null, "No se repite"], ...Object.entries(REPEAT_LABEL)].forEach(([k, label]) =>
      repeatChips.append(h("button", { class: `chip ${t.repeat === k ? "on" : ""}`, onclick: () => ((t.repeat = k), draw()) }, label))
    );
    clear(minutesChips);
    clear(effortChips);
    clear(prioChips);
    MINUTES.forEach((m) =>
      minutesChips.append(h("button", { class: `chip ${t.minutes === m ? "on" : ""}`, onclick: () => ((t.minutes = m), (minutesAuto = false), draw()) }, m >= 60 ? `${m / 60} h`.replace(".5", ",5") : `${m} min`))
    );
    if (!MINUTES.includes(t.minutes)) minutesChips.append(h("button", { class: "chip on" }, `${t.minutes} min`));
    Object.entries(EFFORT_LABEL).forEach(([k, label]) =>
      effortChips.append(h("button", { class: `chip ${t.effort === k ? "on" : ""}`, onclick: () => ((t.effort = k), (effortAuto = false), draw()) }, label))
    );
    PRIORITIES.forEach(([k, label]) =>
      prioChips.append(h("button", { class: `chip ${t.priority === k ? "on" : ""}`, onclick: () => ((t.priority = k), draw()) }, label))
    );
  };
  draw();

  const save = () => {
    const name = title.value.trim();
    if (!name) return void (error.textContent = "Escribí qué hay que hacer.");
    if (subInput.value.trim()) addSub(); // un paso escrito y no agregado todavía no se pierde
    const data = { title: name, minutes: t.minutes, minutesAuto, effortAuto, effort: t.effort, priority: t.priority, due: due.value || null, repeat: t.repeat ?? null, subtasks: t.subtasks };
    if (task) {
      updateTask(task.id, { ...data, notBefore: null });
      toast("Listo, replanifiqué.");
    } else {
      addTask(data);
      toast("Anotada. Ya la ubiqué en tu semana.");
    }
    closeSheet();
  };

  openSheet(
    h("h2", null, task ? "Editar tarea" : "Nueva tarea"),
    h("div", { class: "field" }, h("label", null, "Tarea"), title),
    h("div", { class: "field" }, h("span", { class: "lbl" }, "Cuánto tarda", minutesNote), minutesChips),
    h("div", { class: "field" }, h("span", { class: "lbl" }, "Esfuerzo mental"), effortChips),
    h("div", { class: "field" }, h("span", { class: "lbl" }, "Prioridad"), prioChips),
    h("div", { class: "field" }, h("label", null, "Fecha límite (opcional)"), due),
    h("div", { class: "field" }, h("span", { class: "lbl" }, "Repetir"), repeatChips),
    h("div", { class: "field" }, h("span", { class: "lbl" }, "Pasos (opcional)"), subList, h("div", { class: "sub-add" }, subInput, h("button", { class: "btn quiet", onclick: addSub }, "Agregar"))),
    error,
    h(
      "div",
      { class: "actions" },
      h("button", { class: "btn primary", onclick: save }, "Guardar"),
      task &&
        h(
          "button",
          {
            class: "btn danger",
            onclick: () => {
              removeTask(task.id);
              closeSheet();
              toast("Tarea borrada.");
            },
          },
          "Borrar"
        ),
      h("button", { class: "btn quiet", onclick: closeSheet }, "Cancelar")
    )
  );
  title.addEventListener("keydown", (e) => e.key === "Enter" && save());
}
