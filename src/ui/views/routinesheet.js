// Hoja para editar un ítem de la rutina diaria: duración, cada cuánto, qué días y en qué momento del día.

import { h } from "../dom.js";
import { openSheet, closeSheet, toast } from "../components.js";
import { segmented, tiles, stepper, dayPicker } from "../controls.js";
import { updateRoutineItem } from "../state.js";
import { EFFORT_LABEL } from "../dom.js";

const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
const PARTS = [
  { value: null, label: "Cualquiera" },
  { value: "morning", label: "Mañana" },
  { value: "afternoon", label: "Tarde" },
  { value: "evening", label: "Noche" },
];

export function openRoutineSheet(item) {
  const r = { ...item, days: item.days ? [...item.days] : [] };
  const title = h("input", { type: "text", value: r.title, maxLength: 60, "aria-label": "Nombre" });
  const error = h("p", { class: "small", style: "color:var(--accent);min-height:1.2em", role: "alert" });

  const daysBox = h("div", { class: "field" });
  const drawDays = () => {
    daysBox.replaceChildren();
    if (r.repeat === "month") return;
    daysBox.append(
      h("span", { class: "lbl" }, r.repeat === "day" ? "Qué días" : "Qué día de la semana"),
      dayPicker({ days: r.days, onChange: (d) => (r.days = d) }),
      h("p", { class: "muted small" }, r.repeat === "day" ? "Sin elegir ninguno, es todos los días." : "Sin elegir ninguno, la app lo ubica donde entre mejor.")
    );
  };
  drawDays();

  const save = () => {
    const name = title.value.trim();
    if (!name) return void (error.textContent = "Ponele un nombre.");
    updateRoutineItem({ ...r, title: name, days: r.days.length === 7 ? [] : r.days });
    closeSheet();
    toast("Listo, replanifiqué.");
  };

  openSheet(
    h("h2", null, "Editar rutina"),
    h("div", { class: "field" }, h("label", null, "Tarea"), title),
    h("div", { class: "field" }, h("span", { class: "lbl" }, "Cuánto tarda"), stepper({ value: r.minutes, onChange: (v) => (r.minutes = v) })),
    h("div", { class: "field" }, h("span", { class: "lbl" }, "Esfuerzo mental"), segmented({ options: Object.entries(EFFORT_LABEL).map(([k, l]) => ({ value: k, label: cap(l), dot: k })), value: r.effort, label: "Esfuerzo mental", onChange: (v) => (r.effort = v) })),
    h(
      "div",
      { class: "field" },
      h("span", { class: "lbl" }, "Cada cuánto"),
      tiles({
        options: [
          { value: "day", label: "Todos los días" },
          { value: "week", label: "Cada semana" },
          { value: "2weeks", label: "Cada 2 semanas" },
          { value: "month", label: "Cada mes" },
        ],
        value: r.repeat,
        label: "Cada cuánto",
        onChange: (v) => ((r.repeat = v), drawDays()),
      })
    ),
    daysBox,
    h("div", { class: "field" }, h("span", { class: "lbl" }, "Momento del día"), segmented({ options: PARTS, value: r.part ?? null, compact: true, label: "Momento del día", onChange: (v) => (r.part = v) })),
    error,
    h("div", { class: "actions" }, h("button", { class: "btn primary", onclick: save }, "Guardar"), h("button", { class: "btn quiet", onclick: closeSheet }, "Cancelar"))
  );
  title.addEventListener("keydown", (e) => e.key === "Enter" && save());
}
