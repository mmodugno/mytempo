// Primer uso: unas pocas preguntas para armar el perfil. Todo se puede cambiar después en Ajustes.

import { h, clear } from "../dom.js";
import { app, saveProfile, reload } from "../state.js";
import { defaultProfile } from "../../store/profile.js";
import { energyEditor, blockSheet, daysLabel, openSheet, closeSheet, toast } from "../components.js";
import { newBlockId } from "../../store/profile.js";

const STEPS = 5;

export function renderOnboarding() {
  const draft = defaultProfile();
  let step = 0;
  const overlay = h("div", { class: "onb" });
  const inner = h("div", { class: "onb-inner" });
  overlay.append(inner);

  const next = () => ((step += 1), draw());
  const back = () => ((step -= 1), draw());

  const finish = () => {
    try {
      saveProfile(draft);
      app.onboarding = false;
      reload();
      toast("Listo. Sumá tu primera tarea abajo.");
    } catch (e) {
      toast(e.message);
    }
  };

  const nav = (canNext = true, nextLabel = "Siguiente", onNext = next) =>
    h("div", { class: "actions", style: "margin-top:24px" }, step > 0 && h("button", { class: "btn quiet", onclick: back }, "Atrás"), h("button", { class: "btn primary", style: "flex:1", disabled: !canNext, onclick: onNext }, nextLabel));

  const progress = () => h("div", { class: "progress", "aria-hidden": "true" }, Array.from({ length: STEPS }, (_, i) => h("i", { class: i <= step ? "on" : "" })));

  const screens = [
    // 0 · Bienvenida
    () => {
      const name = h("input", { type: "text", value: draft.name, placeholder: "Tu nombre (opcional)", maxLength: 30, oninput: () => (draft.name = name.value.trim()) });
      return [
        h("h1", null, "Hola. Armemos tu tempo."),
        h("p", { class: "lead" }, "Te hago unas preguntas cortas sobre tu rutina y tu energía. Con eso, mytempo organiza tus tareas por vos. Tus datos quedan solo en este dispositivo."),
        h("div", { class: "field" }, h("label", null, "¿Cómo te llamás?"), name),
        h("div", { class: "spacer" }),
        nav(true, "Empezar"),
        h("button", { class: "btn quiet block", style: "margin-top:10px", onclick: useExample }, "Probar con un perfil de ejemplo"),
      ];
    },
    // 1 · Sueño
    () => {
      const wake = h("input", { type: "time", value: draft.wake, onchange: () => wake.value && (draft.wake = wake.value) });
      const sleep = h("input", { type: "time", value: draft.sleep, onchange: () => sleep.value && (draft.sleep = sleep.value) });
      return [
        h("h1", null, "¿Cómo es tu día?"),
        h("p", { class: "lead" }, "Más o menos, en promedio. La app planifica solo entre estas dos horas."),
        h("div", { class: "field" }, h("label", null, "Me levanto a las"), wake),
        h("div", { class: "field" }, h("label", null, "Me acuesto a las"), sleep),
        h("div", { class: "spacer" }),
        nav(),
      ];
    },
    // 2 · Horarios fijos
    () => {
      const list = h("div");
      const drawList = () => {
        clear(list);
        draft.fixedBlocks.forEach((b) =>
          list.append(h("button", { class: "block-item", onclick: () => edit(b) }, h("span", null, h("b", null, b.title), h("small", null, `${daysLabel(b.days)} · ${b.start}–${b.end}`)), h("span", { class: "muted" }, "Editar")))
        );
      };
      const edit = (block) =>
        openSheet(
          ...blockSheet(block, {
            onSave: (b) => {
              const i = draft.fixedBlocks.findIndex((x) => x.id === b.id);
              if (i >= 0) draft.fixedBlocks[i] = b;
              else draft.fixedBlocks.push(b);
              closeSheet();
              drawList();
            },
            onDelete: (b) => {
              draft.fixedBlocks = draft.fixedBlocks.filter((x) => x.id !== b.id);
              closeSheet();
              drawList();
            },
          })
        );
      drawList();
      return [
        h("h1", null, "Lo que no se mueve"),
        h("p", { class: "lead" }, "Trabajo, viajes, clases, comidas, cualquier cosa fija de tu semana. Podés agregar más después."),
        list,
        h("div", { class: "actions" },
          h("button", { class: "btn", onclick: () => edit(null) }, "+ Agregar"),
          h("button", { class: "btn quiet", onclick: () => ((draft.fixedBlocks.push({ id: newBlockId(), title: "Trabajo", kind: "work", days: [1, 2, 3, 4, 5], start: "09:00", end: "18:00" }), drawList())) }, "Trabajo L–V 9 a 18")
        ),
        h("div", { class: "spacer" }),
        nav(true, draft.fixedBlocks.length ? "Siguiente" : "Seguir sin horarios"),
      ];
    },
    // 3 · Energía
    () => [
      h("h1", null, "¿Cuándo tenés la cabeza clara?"),
      h("p", { class: "lead" }, "Elegí lo que más se parezca a vos y ajustá las barras. Después la app aprende de tus check-ins."),
      energyEditor(draft.energy),
      h("div", { class: "spacer" }),
      nav(),
    ],
    // 4 · Tiempo libre
    () => {
      const num = (get, set, max) =>
        h("input", { type: "number", inputMode: "numeric", min: 0, max, value: get(), onchange: (e) => set(Math.max(0, Math.min(max, parseInt(e.target.value, 10) || 0))) });
      return [
        h("h1", null, "Tiempo para vos"),
        h("p", { class: "lead" }, "Cuánto tiempo querés dejar libre por día, sin tareas. Es lo último que la app va a ocupar."),
        h("div", { class: "field" }, h("label", null, "Entre semana (minutos)"), num(() => draft.freeMinutes.weekday, (v) => (draft.freeMinutes.weekday = v), 720)),
        h("div", { class: "field" }, h("label", null, "Fin de semana (minutos)"), num(() => draft.freeMinutes.weekend, (v) => (draft.freeMinutes.weekend = v), 960)),
        h("div", { class: "field" }, h("label", null, "Pausa entre tareas (minutos)"), num(() => draft.breakMinutes, (v) => (draft.breakMinutes = v), 60)),
        h("div", { class: "spacer" }),
        nav(true, "Armar mi semana", finish),
      ];
    },
  ];

  async function useExample() {
    try {
      const res = await fetch("data/perfil-ejemplo.json", { cache: "no-cache" });
      app.store.importAll(await res.text());
      app.onboarding = false;
      reload();
      toast("Perfil de ejemplo cargado. Podés cambiarlo en Ajustes.");
    } catch {
      toast("No pude cargar el perfil de ejemplo.");
    }
  }

  function draw() {
    clear(inner);
    inner.append(progress(), ...screens[step]());
    overlay.scrollTop = 0;
  }
  draw();
  return overlay;
}
