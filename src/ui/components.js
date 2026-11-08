// Piezas reutilizables: hojas inferiores, avisos, franja del día, editores.

import { h, clear, hm, DAY_SHORT } from "./dom.js";
import { parseHM, isWeekend } from "../engine/time.js";
import { DEFAULT_ENERGY } from "../engine/energy.js";
import { newBlockId } from "../store/profile.js";

/* ---------- Hojas y avisos ---------- */

let scrim = null;

export function openSheet(...content) {
  closeSheet();
  scrim = h(
    "div",
    { class: "scrim", onclick: (e) => e.target === scrim && closeSheet() },
    h("div", { class: "sheet", role: "dialog", "aria-modal": "true" }, ...content)
  );
  document.body.append(scrim);
  const first = scrim.querySelector("input[type=text]");
  if (first && !first.value) first.focus();
}

export function closeSheet() {
  scrim?.remove();
  scrim = null;
}

let toastTimer;
export function toast(msg) {
  document.querySelector(".toast")?.remove();
  const el = h("div", { class: "toast", role: "status" }, msg);
  document.body.append(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2600);
}

/* ---------- Franja del día ---------- */

/** Línea de tiempo de hoy: el fondo dorado es tu energía, lo rayado son bloques fijos, lo terracota son tareas. */
export function dayStrip(profile, day, now, showNow = true) {
  const wake = parseHM(profile.wake);
  let sleep = parseHM(profile.sleep);
  if (sleep <= wake) sleep += 1440;
  const span = sleep - wake;
  const pct = (m) => Math.max(0, Math.min(100, ((m - wake) / span) * 100));

  const date = new Date(day.date + "T00:00:00");
  const curve = isWeekend(date) ? profile.energy.weekend : profile.energy.weekday;
  const stops = [];
  for (let m = wake; m <= sleep; m += 30) {
    const level = curve[Math.floor((m % 1440) / 60)];
    stops.push(`rgba(var(--sun), ${(0.06 + (level / 5) * 0.5).toFixed(2)}) ${pct(m).toFixed(1)}%`);
  }
  const strip = h("div", { class: "strip", style: `background-image: linear-gradient(to right, ${stops.join(", ")})` });

  for (const it of day.items) {
    if (it.type === "break") continue;
    const left = pct(it.start);
    const width = pct(it.end) - left;
    if (width <= 0) continue;
    const cls = it.type === "fixed" ? "fixed" : `task ${it.effort === "light" ? "light" : ""}`;
    strip.append(h("div", { class: `seg ${cls}`, style: `left:${left}%;width:${width}%`, title: it.title }));
  }
  if (showNow) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const m = nowMin < wake ? nowMin + 1440 : nowMin;
    if (m >= wake && m <= sleep) strip.append(h("div", { class: "nowline", style: `left:${pct(m)}%` }));
  }

  const ticks = h("div", { class: "strip-ticks" });
  for (let hour = Math.ceil(wake / 180) * 3; hour * 60 <= sleep; hour += 3) {
    ticks.append(h("span", { style: `left:${pct(hour * 60)}%` }, String(hour % 24)));
  }
  return h(
    "div",
    null,
    strip,
    ticks,
    h(
      "div",
      { class: "legend" },
      h("span", null, h("i", { style: "background:rgba(var(--sun),0.7)" }), "tu energía"),
      h("span", null, h("i", { style: "background:var(--fixed)" }), "horarios fijos"),
      h("span", null, h("i", { style: "background:var(--accent)" }), "tareas")
    )
  );
}

/* ---------- Editor de energía ---------- */

const PRESETS = {
  manana: { label: "Soy de mañana", weekday: DEFAULT_ENERGY.weekday, weekend: DEFAULT_ENERGY.weekend },
  tarde: {
    label: "Soy de tarde",
    weekday: [1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 3, 3, 4, 5, 5, 5, 4, 4, 3, 2, 2, 1],
    weekend: [1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 3, 3, 4, 4, 5, 5, 5, 4, 4, 3, 2, 2, 1],
  },
  noche: {
    label: "Soy nocturna",
    weekday: [3, 2, 1, 1, 1, 1, 1, 1, 1, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 4],
    weekend: [4, 3, 2, 1, 1, 1, 1, 1, 1, 1, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5, 5, 5, 4],
  },
};

/** Toca una barra para subir o bajar ese horario (1 a 5). `energy` se modifica en el lugar. */
export function energyEditor(energy, onChange) {
  let which = "weekday";
  const root = h("div");

  const render = () => {
    clear(root);
    const bars = h("div", { class: "bars" });
    energy[which].forEach((level, hour) => {
      bars.append(
        h("button", {
          "data-l": level,
          "aria-label": `${hour}:00, energía ${level} de 5`,
          onclick: () => {
            energy[which][hour] = (level % 5) + 1;
            onChange?.();
            render();
          },
        })
      );
    });
    root.append(
      h(
        "div",
        { class: "chips", style: "margin-bottom:10px" },
        Object.entries(PRESETS).map(([key, p]) =>
          h(
            "button",
            {
              class: "chip",
              onclick: () => {
                energy.weekday = [...p.weekday];
                energy.weekend = [...p.weekend];
                onChange?.();
                render();
              },
            },
            p.label
          )
        )
      ),
      h(
        "div",
        { class: "chips" },
        h("button", { class: `chip ${which === "weekday" ? "on" : ""}`, onclick: () => ((which = "weekday"), render()) }, "Días de semana"),
        h("button", { class: `chip ${which === "weekend" ? "on" : ""}`, onclick: () => ((which = "weekend"), render()) }, "Fin de semana")
      ),
      bars,
      h("div", { class: "bar-hours" }, ["0", "6", "12", "18", "23"].map((x) => h("span", null, x))),
      h("p", { class: "muted small" }, "Más alta = cabeza más clara. Tocá una barra para cambiarla.")
    );
  };
  render();
  return root;
}

/* ---------- Editor de un bloque fijo ---------- */

export const KIND_OPTIONS = [
  ["work", "Trabajo"],
  ["study", "Estudio"],
  ["travel", "Viaje"],
  ["meal", "Comida"],
  ["commitment", "Compromiso"],
];

/** Hoja para crear o editar un bloque fijo semanal. */
export function blockSheet(block, { onSave, onDelete }) {
  const b = block ? structuredClone(block) : { id: newBlockId(), title: "", kind: "commitment", days: [1, 2, 3, 4, 5], start: "09:00", end: "10:00" };
  const title = h("input", { type: "text", value: b.title, placeholder: "Ej: Trabajo, Pilates, Viaje", maxLength: 40 });
  const start = h("input", { type: "time", value: b.start });
  const end = h("input", { type: "time", value: b.end });
  const dayChips = h("div", { class: "chips" });
  const kindChips = h("div", { class: "chips" });
  const error = h("p", { class: "small", style: "color:var(--accent);min-height:1.2em", role: "alert" });

  const drawDays = () => {
    clear(dayChips);
    [1, 2, 3, 4, 5, 6, 0].forEach((d) =>
      dayChips.append(
        h(
          "button",
          {
            class: `chip ${b.days.includes(d) ? "on" : ""}`,
            "aria-pressed": b.days.includes(d),
            onclick: () => {
              b.days = b.days.includes(d) ? b.days.filter((x) => x !== d) : [...b.days, d];
              drawDays();
            },
          },
          DAY_SHORT[d]
        )
      )
    );
  };
  const drawKinds = () => {
    clear(kindChips);
    KIND_OPTIONS.forEach(([k, label]) =>
      kindChips.append(h("button", { class: `chip ${b.kind === k ? "on" : ""}`, onclick: () => ((b.kind = k), drawKinds()) }, label))
    );
  };
  drawDays();
  drawKinds();

  return [
    h("h2", null, block ? "Editar horario fijo" : "Nuevo horario fijo"),
    h("div", { class: "field" }, h("label", null, "Nombre"), title),
    h("div", { class: "field" }, h("span", { class: "lbl" }, "Días"), dayChips),
    h("div", { class: "two" }, h("div", { class: "field" }, h("label", null, "Desde"), start), h("div", { class: "field" }, h("label", null, "Hasta"), end)),
    h("div", { class: "field" }, h("span", { class: "lbl" }, "Tipo"), kindChips),
    error,
    h(
      "div",
      { class: "actions" },
      h(
        "button",
        {
          class: "btn primary",
          onclick: () => {
            b.title = title.value.trim();
            b.start = start.value;
            b.end = end.value;
            if (!b.title) return void (error.textContent = "Ponele un nombre.");
            if (!b.days.length) return void (error.textContent = "Elegí al menos un día.");
            if (!b.start || !b.end || parseHM(b.end) <= parseHM(b.start)) return void (error.textContent = "La hora de fin tiene que ser después de la de inicio.");
            onSave(b);
          },
        },
        "Guardar"
      ),
      block && h("button", { class: "btn danger", onclick: () => onDelete(b) }, "Borrar"),
      h("button", { class: "btn quiet", onclick: closeSheet }, "Cancelar")
    ),
  ];
}

/** Hoja para un compromiso de un solo día (un curso, un turno, una salida). */
export function oneOffSheet(block, defaultDate, { onSave, onDelete }) {
  const b = block ? structuredClone(block) : { id: newBlockId(), title: "", kind: "commitment", date: defaultDate, start: "19:00", end: "21:00" };
  const title = h("input", { type: "text", value: b.title, placeholder: "Ej: Curso, turno médico, cumple", maxLength: 40 });
  const date = h("input", { type: "date", value: b.date });
  const start = h("input", { type: "time", value: b.start });
  const end = h("input", { type: "time", value: b.end });
  const error = h("p", { class: "small", style: "color:var(--accent);min-height:1.2em", role: "alert" });
  return [
    h("h2", null, block ? "Editar compromiso" : "Compromiso de un día"),
    h("div", { class: "field" }, h("label", null, "Nombre"), title),
    h("div", { class: "field" }, h("label", null, "Día"), date),
    h("div", { class: "two" }, h("div", { class: "field" }, h("label", null, "Desde"), start), h("div", { class: "field" }, h("label", null, "Hasta"), end)),
    error,
    h(
      "div",
      { class: "actions" },
      h(
        "button",
        {
          class: "btn primary",
          onclick: () => {
            b.title = title.value.trim();
            b.date = date.value;
            b.start = start.value;
            b.end = end.value;
            if (!b.title) return void (error.textContent = "Ponele un nombre.");
            if (!b.date) return void (error.textContent = "Elegí el día.");
            if (!b.start || !b.end || parseHM(b.end) <= parseHM(b.start)) return void (error.textContent = "La hora de fin tiene que ser después de la de inicio.");
            onSave(b);
          },
        },
        "Guardar"
      ),
      block && h("button", { class: "btn danger", onclick: () => onDelete(b) }, "Borrar"),
      h("button", { class: "btn quiet", onclick: closeSheet }, "Cancelar")
    ),
  ];
}

/** Lista legible de días: "Lun, Mié, Vie" */
export function daysLabel(days) {
  return [1, 2, 3, 4, 5, 6, 0].filter((d) => days.includes(d)).map((d) => DAY_SHORT[d]).join(", ");
}

export { hm };
