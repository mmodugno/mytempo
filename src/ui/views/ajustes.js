// Ajustes: todo lo que la app sabe de vos se puede cambiar acá.

import { h, clear } from "../dom.js";
import { app, saveProfile, reload } from "../state.js";
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
  const wake = h("input", { type: "time", value: p.wake, onchange: () => (wake.value && ((p.wake = wake.value), commit())) });
  const sleep = h("input", { type: "time", value: p.sleep, onchange: () => (sleep.value && ((p.sleep = sleep.value), commit())) });
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

  // Energía
  const learnChips = h("div", { class: "chips" });
  const drawLearn = () => {
    clear(learnChips);
    [[true, "Sí, aprender"], [false, "No, usar solo mi curva"]].forEach(([v, label]) =>
      learnChips.append(h("button", { class: `chip ${(p.learn !== false) === v ? "on" : ""}`, onclick: () => ((p.learn = v), commit(), drawLearn()) }, label))
    );
  };
  drawLearn();
  root.append(
    h("div", { class: "eyebrow" }, "Tu energía"),
    energyEditor(p.energy, commit),
    h("div", { class: "field", style: "margin-top:18px" }, h("span", { class: "lbl" }, "¿Ajustar mi curva con lo que dicen mis check-ins?"), learnChips)
  );

  // Apariencia
  const themeNow = localStorage.getItem("mytempo.theme") ?? "auto";
  root.append(
    h("div", { class: "eyebrow" }, "Apariencia"),
    h(
      "div",
      { class: "chips" },
      [["auto", "Automático"], ["light", "Claro"], ["dark", "Oscuro"]].map(([k, label]) =>
        h("button", { class: `chip ${themeNow === k ? "on" : ""}`, onclick: () => setTheme(k) }, label)
      )
    )
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
