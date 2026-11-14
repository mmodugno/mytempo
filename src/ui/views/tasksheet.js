// Hoja para crear o editar una tarea con todos sus datos (todos opcionales menos el título).

import { h, clear, EFFORT_LABEL } from "../dom.js";
import { openSheet, closeSheet, toast } from "../components.js";
import { REPEAT_LABEL } from "../../engine/repeat.js";
import { app, addTask, updateTask, removeTask } from "../state.js";
import { estimate } from "../../engine/estimate.js";
import { segmented, tiles, stepper, quickDate } from "../controls.js";

const PRIORITIES = [
  [1, "Baja"],
  [2, "Normal"],
  [3, "Alta"],
];
const QUICK_MINUTES = [10, 15, 30, 60, 90];
const quickLabel = (m) => (m >= 60 ? `${m / 60} h`.replace(".5", ",5") : `${m} min`);
const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);

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

  // Controles: cada uno guarda su estado y avisa; acá solo los conectamos con la tarea.
  const setMinutes = (v) => {
    t.minutes = v;
    minutesCtl.set(v);
    quickCtl.set(v);
    minutesNote.textContent = minutesAuto ? " · estimada, tocá para ajustar" : "";
  };
  const minutesCtl = stepper({ value: t.minutes, onChange: (v) => ((minutesAuto = false), setMinutes(v)) });
  const quickCtl = segmented({ options: QUICK_MINUTES.map((m) => ({ value: m, label: quickLabel(m) })), value: t.minutes, compact: true, label: "Duración rápida", onChange: (v) => ((minutesAuto = false), setMinutes(v)) });
  const effortCtl = segmented({ options: Object.entries(EFFORT_LABEL).map(([k, l]) => ({ value: k, label: cap(l), dot: k })), value: t.effort, label: "Esfuerzo mental", onChange: (v) => ((effortAuto = false), (t.effort = v)) });
  const prioCtl = segmented({ options: PRIORITIES.map(([value, label]) => ({ value, label })), value: t.priority, label: "Prioridad", onChange: (v) => (t.priority = v) });
  const dueCtl = quickDate({ value: t.due ?? null, today: app.now, onChange: (v) => (t.due = v) });
  const repeatCtl = tiles({
    options: [{ value: null, label: "No se repite", wide: true }, ...Object.entries(REPEAT_LABEL).map(([value, label]) => ({ value, label: cap(label) }))],
    value: t.repeat ?? null,
    label: "Repetir",
    onChange: (v) => (t.repeat = v),
  });
  const draw = () => {
    effortCtl.set(t.effort);
    setMinutes(t.minutes);
  };
  draw();

  const save = () => {
    const name = title.value.trim();
    if (!name) return void (error.textContent = "Escribí qué hay que hacer.");
    if (subInput.value.trim()) addSub(); // un paso escrito y no agregado todavía no se pierde
    const data = { title: name, minutes: t.minutes, minutesAuto, effortAuto, effort: t.effort, priority: t.priority, due: t.due || null, repeat: t.repeat ?? null, subtasks: t.subtasks };
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
    h("div", { class: "field" }, h("span", { class: "lbl" }, "Cuánto tarda", minutesNote), minutesCtl, h("div", { class: "opt-gap" }, quickCtl)),
    h("div", { class: "field" }, h("span", { class: "lbl" }, "Esfuerzo mental"), effortCtl),
    h("div", { class: "field" }, h("span", { class: "lbl" }, "Prioridad"), prioCtl),
    h("div", { class: "field" }, h("span", { class: "lbl" }, "Fecha límite"), dueCtl),
    h("div", { class: "field" }, h("span", { class: "lbl" }, "Repetir"), repeatCtl),
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
