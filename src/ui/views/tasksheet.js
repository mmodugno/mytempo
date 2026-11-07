// Hoja para crear o editar una tarea con todos sus datos (todos opcionales menos el título).

import { h, clear, EFFORT_LABEL } from "../dom.js";
import { openSheet, closeSheet, toast } from "../components.js";
import { addTask, updateTask, removeTask } from "../state.js";

const MINUTES = [15, 30, 45, 60, 90, 120, 180];
const PRIORITIES = [
  [1, "Baja"],
  [2, "Normal"],
  [3, "Alta"],
];

export function openTaskSheet(task, draft = {}) {
  const t = { title: "", minutes: 30, effort: "medium", priority: 2, due: null, ...draft, ...(task ?? {}) };
  const title = h("input", { type: "text", value: t.title, placeholder: "¿Qué hay que hacer?", maxLength: 120 });
  const due = h("input", { type: "date", value: t.due ?? "" });
  const minutesChips = h("div", { class: "chips" });
  const effortChips = h("div", { class: "chips" });
  const prioChips = h("div", { class: "chips" });
  const error = h("p", { class: "small", style: "color:var(--accent);min-height:1.2em", role: "alert" });

  const draw = () => {
    clear(minutesChips);
    clear(effortChips);
    clear(prioChips);
    MINUTES.forEach((m) =>
      minutesChips.append(h("button", { class: `chip ${t.minutes === m ? "on" : ""}`, onclick: () => ((t.minutes = m), draw()) }, m >= 60 ? `${m / 60} h`.replace(".5", ",5") : `${m} min`))
    );
    if (!MINUTES.includes(t.minutes)) minutesChips.append(h("button", { class: "chip on" }, `${t.minutes} min`));
    Object.entries(EFFORT_LABEL).forEach(([k, label]) =>
      effortChips.append(h("button", { class: `chip ${t.effort === k ? "on" : ""}`, onclick: () => ((t.effort = k), draw()) }, label))
    );
    PRIORITIES.forEach(([k, label]) =>
      prioChips.append(h("button", { class: `chip ${t.priority === k ? "on" : ""}`, onclick: () => ((t.priority = k), draw()) }, label))
    );
  };
  draw();

  const save = () => {
    const name = title.value.trim();
    if (!name) return void (error.textContent = "Escribí qué hay que hacer.");
    const data = { title: name, minutes: t.minutes, effort: t.effort, priority: t.priority, due: due.value || null };
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
    h("div", { class: "field" }, h("span", { class: "lbl" }, "Cuánto tarda"), minutesChips),
    h("div", { class: "field" }, h("span", { class: "lbl" }, "Esfuerzo mental"), effortChips),
    h("div", { class: "field" }, h("span", { class: "lbl" }, "Prioridad"), prioChips),
    h("div", { class: "field" }, h("label", null, "Fecha límite (opcional)"), due),
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
