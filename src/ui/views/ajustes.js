// Ajustes: todo lo que la app sabe de vos se puede cambiar acá.

import { h, clear, shortDate, timeField, dur } from "../dom.js";
import { REPEAT_LABEL } from "../../engine/repeat.js";
import { estimate } from "../../engine/estimate.js";
import { segmented, toggle } from "../controls.js";
import { openRoutineSheet } from "./routinesheet.js";
import { PART_LABEL, ROUTINE_CATALOG, fromCatalog, newRoutineId } from "../../store/routine.js";
import { app, saveProfile, reload } from "../state.js";
import { openOneOff, upcomingOneOffs } from "./oneoff.js";
import { supported, getSettings, saveSettings, enable, disable, testNotification, isNative, active as remindersActive } from "../notifications.js";
import { energyEditor, blockSheet, daysLabel, openSheet, closeSheet, toast } from "../components.js";

export function renderAjustes() {
  const p = app.profile;
  const root = h("div");

  const commit = () => {
    try {
      saveProfile(p);
    } catch (e) {
      toast(e.message);
    }
  };

  // Datos básicos
  const name = h("input", { type: "text", value: p.name ?? "", placeholder: "Tu nombre", maxLength: 30, onchange: () => ((p.name = name.value.trim()), commit()) });
  const wake = timeField(p.wake, { onchange: () => ((p.wake = wake.value), commit()) });
  const sleep = timeField(p.sleep, { onchange: () => ((p.sleep = sleep.value), commit()) });
  const num = (get, set, max) =>
    h("input", {
      type: "number",
      inputMode: "numeric",
      min: 0,
      max,
      value: get(),
      onchange: (e) => {
        const v = Math.max(0, Math.min(max, parseInt(e.target.value, 10) || 0));
        set(v);
        commit();
      },
    });

  root.append(
    h("div", { class: "eyebrow" }, "Vos"),
    h("div", { class: "field" }, h("label", null, "Nombre"), name),
    h("div", { class: "two" }, h("div", { class: "field" }, h("label", null, "Me levanto"), wake), h("div", { class: "field" }, h("label", null, "Me acuesto"), sleep)),

    h("div", { class: "eyebrow" }, "Tiempo para vos"),
    h("div", { class: "two" },
      h("div", { class: "field" }, h("label", null, "Libre entre semana (min)"), num(() => p.freeMinutes.weekday, (v) => (p.freeMinutes.weekday = v), 720)),
      h("div", { class: "field" }, h("label", null, "Libre fin de semana (min)"), num(() => p.freeMinutes.weekend, (v) => (p.freeMinutes.weekend = v), 960))
    ),
    h("div", { class: "field" }, h("label", null, "Pausa entre tareas (min)"), num(() => p.breakMinutes, (v) => (p.breakMinutes = v), 60)),
    h("p", { class: "muted small" }, "El tiempo libre es lo que la app nunca llena con tareas.")
  );

  root.append(routineSection(p, commit), petSection(p, commit));

  // Horarios fijos
  const blocks = h("div");
  const drawBlocks = () => {
    clear(blocks);
    if (!p.fixedBlocks.length) blocks.append(h("p", { class: "muted small" }, "Todavía no cargaste horarios fijos."));
    [...p.fixedBlocks]
      .sort((a, b) => a.start.localeCompare(b.start))
      .forEach((b) =>
        blocks.append(
          h(
            "button",
            { class: "block-item", onclick: () => editBlock(b) },
            h("span", null, h("b", null, b.title), h("small", null, `${daysLabel(b.days)} · ${b.start}–${b.end}`)),
            h("span", { class: "muted" }, "Editar")
          )
        )
      );
  };
  const editBlock = (block) =>
    openSheet(
      ...blockSheet(block, {
        onSave: (b) => {
          const i = p.fixedBlocks.findIndex((x) => x.id === b.id);
          if (i >= 0) p.fixedBlocks[i] = b;
          else p.fixedBlocks.push(b);
          commit();
          closeSheet();
          toast("Horario guardado.");
        },
        onDelete: (b) => {
          p.fixedBlocks = p.fixedBlocks.filter((x) => x.id !== b.id);
          commit();
          closeSheet();
        },
      })
    );
  drawBlocks();
  root.append(h("div", { class: "eyebrow" }, "Horarios fijos"), blocks, h("button", { class: "btn block", style: "margin-top:12px", onclick: () => editBlock(null) }, "+ Agregar horario fijo"));

  // Compromisos puntuales
  const ones = upcomingOneOffs();
  root.append(
    h("div", { class: "eyebrow" }, "Compromisos de un día"),
    ...(ones.length
      ? ones.map((b) =>
          h("button", { class: "block-item", onclick: () => openOneOff(b) }, h("span", null, h("b", null, b.title), h("small", null, `${shortDate(b.date)} · ${b.start}–${b.end}`)), h("span", { class: "muted" }, "Editar"))
        )
      : [h("p", { class: "muted small" }, "Cursos, turnos o salidas de una sola vez. La app los respeta y reacomoda el resto.")]),
    h("button", { class: "btn block", style: "margin-top:12px", onclick: () => openOneOff() }, "+ Agregar compromiso de un día")
  );

  // Energía
  root.append(
    h("div", { class: "eyebrow" }, "Tu energía"),
    energyEditor(p.energy, commit),
    h("div", { style: "margin-top:18px" }, toggle({ checked: p.learn !== false, label: "Aprender de mis check-ins", hint: "Ajusta tu curva de energía con lo que vas contando.", onChange: (v) => ((p.learn = v), commit()) }))
  );

  // Recordatorios
  const notif = h("div");
  const drawNotif = () => {
    clear(notif);
    if (!supported()) {
      notif.append(h("p", { class: "muted small" }, "Este navegador no permite notificaciones. En la versión Android van a funcionar."));
      return;
    }
    const cfg = getSettings();
    const active = remindersActive();
    notif.append(
      toggle({
        checked: active,
        label: "Avisarme antes de cada tarea",
        hint: "Una notificación unos minutos antes.",
        onChange: async (v) => {
          if (v) {
            const res = await enable();
            if (res === "denied") toast("El permiso está bloqueado: habilitalo en la configuración del navegador.");
          } else disable();
          drawNotif();
        },
      })
    );
    if (active) {
      notif.append(
        h("div", { class: "field", style: "margin-top:14px" }, h("span", { class: "lbl" }, "Con cuánta anticipación"),
          segmented({ options: [5, 10, 15, 30].map((m) => ({ value: m, label: `${m} min` })), value: cfg.lead, compact: true, label: "Anticipación", onChange: (m) => (saveSettings({ ...cfg, lead: m }), drawNotif()) })
        ),
        h("button", { class: "btn quiet", onclick: testNotification }, "Probar un aviso")
      );
    }
    notif.append(h("p", { class: "muted small" }, isNative() ? "Los avisos llegan aunque la app esté cerrada." : "Por ahora los avisos suenan mientras la app esté abierta o en segundo plano. Para que lleguen con la app cerrada hace falta la versión Android."));
  };
  drawNotif();
  root.append(h("div", { class: "eyebrow" }, "Recordatorios"), notif);

  // Apariencia
  const themeNow = localStorage.getItem("mytempo.theme") ?? "auto";
  root.append(
    h("div", { class: "eyebrow" }, "Apariencia"),
    segmented({ options: [["auto", "Automático"], ["light", "Claro"], ["dark", "Oscuro"]].map(([value, label]) => ({ value, label })), value: themeNow, label: "Tema", compact: true, onChange: (k) => setTheme(k) })
  );

  // Datos
  const file = h("input", { type: "file", accept: "application/json,.json", hidden: true, onchange: importFile });
  root.append(
    h("div", { class: "eyebrow" }, "Tus datos"),
    h("p", { class: "muted small" }, "Todo se guarda solo en este dispositivo. Nada se sube a ningún servidor."),
    h("div", { class: "actions" },
      h("button", { class: "btn", onclick: exportData }, "Exportar respaldo"),
      h("button", { class: "btn", onclick: () => file.click() }, "Importar"),
      file
    ),
    h("div", { class: "actions" },
      h("button", { class: "btn quiet", onclick: loadExample }, "Cargar perfil de ejemplo"),
      h("button", { class: "btn danger", onclick: confirmReset }, "Borrar todo")
    ),
    h("p", { class: "muted small", style: "margin-top:24px" }, "mytempo · MVP")
  );
  return root;
}

function setTheme(k) {
  if (k === "auto") {
    localStorage.removeItem("mytempo.theme");
    if (matchMedia("(prefers-color-scheme: dark)").matches) document.documentElement.dataset.theme = "dark";
    else delete document.documentElement.dataset.theme;
  } else {
    localStorage.setItem("mytempo.theme", k);
    document.documentElement.dataset.theme = k;
  }
  reload();
}

function exportData() {
  const blob = new Blob([app.store.exportAll()], { type: "application/json" });
  const a = h("a", { href: URL.createObjectURL(blob), download: "mytempo-respaldo.json" });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast("Respaldo descargado.");
}

async function importFile(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    app.store.importAll(await f.text());
    reload();
    toast("Importado.");
  } catch (err) {
    toast(err.message);
  }
}

async function loadExample() {
  try {
    const res = await fetch("data/perfil-ejemplo.json", { cache: "no-cache" });
    app.store.importAll(await res.text());
    reload();
    toast("Perfil de ejemplo cargado.");
  } catch {
    toast("No pude cargar el perfil de ejemplo.");
  }
}

function confirmReset() {
  openSheet(
    h("h2", null, "¿Borrar todo?"),
    h("p", null, "Se borran tu perfil, tus tareas y tus check-ins de este dispositivo. No se puede deshacer (si querés, exportá un respaldo antes)."),
    h("div", { class: "actions" },
      h("button", { class: "btn danger", onclick: () => ((app.store.clearAll(), closeSheet(), reload())) }, "Sí, borrar"),
      h("button", { class: "btn quiet", onclick: closeSheet }, "Cancelar")
    )
  );
}

/* ---------- Rutina diaria ---------- */

function routineSection(p, commit) {
  p.routine ??= [];
  const box = h("div");
  const input = h("input", { type: "text", placeholder: "Otra tarea de todos los días", maxLength: 60 });
  const draw = () => {
    clear(box);
    if (!p.routine.length) box.append(h("p", { class: "muted small" }, "Todavía no tenés tareas de rutina. Elegí algunas abajo y quedan cargadas solas."));
    p.routine.forEach((r) =>
      box.append(
        h(
          "div",
          { class: "block-item static" },
          h("button", { class: "routine-main", onclick: () => openRoutineSheet(r) }, h("b", null, r.title), h("small", null, routineMeta(r))),
          h(
            "span",
            { class: "row-actions" },
            toggleSmall(r, commit, draw),
            h("button", { class: "x", "aria-label": `Quitar ${r.title}`, onclick: () => ((p.routine = p.routine.filter((x) => x.id !== r.id)), commit(), draw()) }, "×")
          )
        )
      )
    );
    const missing = ROUTINE_CATALOG.filter((c) => !p.routine.some((r) => r.id === c.key));
    if (missing.length) {
      box.append(
        h("div", { class: "lbl small muted", style: "margin:14px 0 6px" }, "Sugeridas"),
        h("div", { class: "chips" }, missing.map((c) => h("button", { class: "chip", onclick: () => (p.routine.push(fromCatalog(c)), commit(), draw()) }, `+ ${c.title}`)))
      );
    }
    box.append(h("div", { class: "field" }, input, h("button", { class: "btn quiet", style: "margin-top:8px", onclick: add }, "+ Sumar otra")));
  };
  const add = () => {
    const title = input.value.trim();
    if (!title) return;
    const e = estimate(title, app.tasks);
    p.routine.push({ id: newRoutineId(), title, minutes: e.minutes, effort: e.effort, repeat: "day", on: true });
    input.value = "";
    commit();
    draw();
  };
  input.addEventListener("keydown", (ev) => ev.key === "Enter" && (ev.preventDefault(), add()));
  draw();
  return h("div", null, h("div", { class: "eyebrow" }, "Rutina diaria"), box);
}

/* ---------- Mascota y racha ---------- */

function petSection(p, commit) {
  const name = h("input", { type: "text", value: p.petName ?? "Pompón", maxLength: 20, onchange: () => ((p.petName = name.value.trim() || "Pompón"), commit()) });
  const rest = segmented({ options: [[0, "Ninguno"], [1, "1 por semana"], [2, "2 por semana"]].map(([value, label]) => ({ value, label })), value: p.streakRest ?? 1, compact: true, label: "Días de descanso", onChange: (v) => ((p.streakRest = v), commit()) });
  return h(
    "div",
    null,
    h("div", { class: "eyebrow" }, "Mascota y racha"),
    h("div", { class: "field" }, h("label", null, "Nombre de tu mascota"), name),
    h("div", { class: "field" }, h("span", { class: "lbl" }, "Días de descanso que no cortan la racha"), rest)
  );
}

function toggleSmall(r, commit, draw) {
  const t = toggle({ checked: r.on, label: "", onChange: (v) => ((r.on = v), commit(), draw()) });
  t.classList.add("small");
  t.setAttribute("aria-label", `${r.on ? "Pausar" : "Activar"} ${r.title}`);
  return t;
}

function routineMeta(r) {
  const bits = [dur(r.minutes), REPEAT_LABEL[r.repeat] ?? r.repeat];
  if (r.days?.length) bits.push(daysLabel(r.days));
  if (r.part) bits.push(PART_LABEL[r.part]);
  if (!r.on) bits.push("en pausa");
  return bits.join(" · ");
}
