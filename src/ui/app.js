// Punto de entrada: arma la carcasa (cabecera, contenido, carga rápida, pestañas) y re-dibuja al cambiar el estado.

import { h, clear, DAY_LONG, MONTHS } from "./dom.js";
import { app, init, subscribe, tick, addTask } from "./state.js";
import { parseQuickTask } from "../engine/parse.js";
import { toast } from "./components.js";
import { reschedule } from "./notifications.js";
import { renderAhora } from "./views/ahora.js";
import { renderTareas, onTareasChange } from "./views/tareas.js";
import { renderSemana } from "./views/semana.js";
import { renderResumen } from "./views/resumen.js";
import { renderAjustes } from "./views/ajustes.js";
import { renderOnboarding } from "./views/onboarding.js";
import { openTaskSheet } from "./views/tasksheet.js";

const TABS = [
  ["ahora", "Ahora", renderAhora],
  ["tareas", "Tareas", renderTareas],
  ["semana", "Semana", renderSemana],
  ["resumen", "Resumen", renderResumen],
  ["ajustes", "Ajustes", renderAjustes],
];

init(window.localStorage);

const root = document.getElementById("app");
const today = h("span", { class: "today" });
const main = h("main", { id: "main" });
const tabs = h("nav", { class: "tabs", "aria-label": "Secciones" });

const input = h("input", { type: "text", placeholder: "Sumar tarea…", enterkeyhint: "send", "aria-label": "Nueva tarea", maxLength: 120 });
const submit = () => {
  const text = input.value.trim();
  if (!text) return;
  const parsed = parseQuickTask(text, app.now);
  if (!parsed.title) return;
  addTask(parsed);
  input.value = "";
  toast("Anotada. Ya la ubiqué en tu semana.");
};
input.addEventListener("keydown", (e) => e.key === "Enter" && submit());

const composer = h(
  "div",
  { class: "composer" },
  input,
  h("button", { class: "more", "aria-label": "Más opciones de la tarea", onclick: () => ((openTaskSheet(null, parseQuickTask(input.value, app.now))), (input.value = "")) }, "⋯"),
  h("button", { class: "add", onclick: submit }, "Sumar")
);

root.append(
  h("header", { class: "topbar" }, h("span", { class: "wordmark" }, "my", h("b", null, "tempo")), today),
  main,
  h("div", null, composer, tabs)
);

let overlay = null;
let lastTab = null;

function render() {
  // Onboarding a pantalla completa mientras no haya perfil.
  if (app.onboarding) {
    if (!overlay) {
      overlay = renderOnboarding();
      document.body.append(overlay);
    }
    return;
  }
  if (overlay) {
    overlay.remove();
    overlay = null;
  }

  const now = app.now;
  today.textContent = `${DAY_LONG[now.getDay()]} ${now.getDate()} de ${MONTHS[now.getMonth()]}`;

  clear(tabs);
  TABS.forEach(([key, label]) =>
    tabs.append(h("button", { "aria-current": app.tab === key ? "page" : null, onclick: () => ((app.tab = key), render()) }, label))
  );

  const scroll = lastTab === app.tab ? main.scrollTop : 0;
  const view = TABS.find(([k]) => k === app.tab)[2];
  clear(main).append(view());
  main.scrollTop = scroll;
  lastTab = app.tab;
}

onTareasChange(render);
subscribe(() => {
  tick();
  render();
  reschedule();
});

// La hora avanza sola: refrescamos cada medio minuto, salvo que esté escribiendo en un campo del contenido.
setInterval(() => {
  if (document.hidden || main.contains(document.activeElement)) return;
  tick();
  render();
}, 30000);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    tick();
    render();
    reschedule(); // si el teléfono durmió la app, avisa lo que quedó pendiente
  }
});

tick();
render();
reschedule();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
