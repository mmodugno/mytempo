// Punto de entrada: arma la carcasa (cabecera, contenido, carga rápida, pestañas) y re-dibuja al cambiar el estado.

import { h, clear, DAY_LONG, MONTHS, linkLabels } from "./dom.js";
import { app, init, subscribe, tick, addTask } from "./state.js";
import { parseQuickTask } from "../engine/parse.js";
import { speechSupported, createVoice } from "./voice.js";
import { toast, closeSheet, sheetOpen } from "./components.js";
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

let mic = null;
if (speechSupported()) {
  mic = h("button", { class: "mic", type: "button", "aria-label": "Dictar tarea por voz", "aria-pressed": "false" }, "🎤");
  const voice = createVoice({
    onText: (t) => (input.value = t.slice(0, 120)),
    onState: (on) => (mic.classList.toggle("on", on), mic.setAttribute("aria-pressed", String(on)), on && toast("Escuchando… decí la tarea.")),
    onError: (m) => toast(m),
  });
  mic.addEventListener("click", voice.toggle);
}

const composer = h(
  "div",
  { class: "composer" },
  input,
  mic,
  h("button", { class: "more", "aria-label": "Más opciones de la tarea", onclick: () => ((openTaskSheet(null, parseQuickTask(input.value, app.now))), (input.value = "")) }, "⋯"),
  h("button", { class: "add", onclick: submit }, "Sumar")
);

// Logo: la misma onda del ícono (markup fijo, sin datos de la persona).
const logo = h("span", { class: "logo", "aria-hidden": "true" });
logo.innerHTML = '<svg viewBox="0 0 28 17" width="28" height="17"><path d="M4 13 A10 10 0 0 1 24 13" fill="none" stroke="var(--accent)" stroke-width="2.6" stroke-linecap="round"/><path d="M1.5 15 H26.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="6.5" cy="6.2" r="2.8" fill="rgb(var(--sun, 232 168 56))"/></svg>';

root.append(
  h("header", { class: "topbar" }, h("span", { class: "wordmark" }, logo, "my", h("b", null, "tempo")), today),
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

  main.classList.toggle("enter", lastTab !== app.tab); // la animación de entrada solo al cambiar de pestaña
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

// Las etiquetas de los formularios (pantallas y hojas) se unen a su campo apenas aparecen.
let linkPending = false;
new MutationObserver(() => {
  if (linkPending) return;
  linkPending = true;
  queueMicrotask(() => ((linkPending = false), linkLabels(document.body)));
}).observe(document.body, { childList: true, subtree: true });
linkLabels(document.body);

// Botón "atrás" de Android (plugin @capacitor/app): cierra la hoja; si no hay, vuelve a "Ahora"; si ya está ahí, sale de la app.
const capApp = globalThis.Capacitor?.Plugins?.App;
capApp?.addListener?.("backButton", () => {
  if (sheetOpen()) return closeSheet();
  if (app.tab !== "ahora") return ((app.tab = "ahora"), render());
  capApp.exitApp?.();
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
