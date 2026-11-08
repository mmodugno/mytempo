// Piezas reutilizables: hojas inferiores, avisos, franja del día, editores.

import { h, clear, hm, timeField, DAY_SHORT } from "./dom.js";
import { parseHM, isWeekend } from "../engine/time.js";
import { DEFAULT_ENERGY, energyInterp, checkinShift } from "../engine/energy.js";
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

/* ---------- Curva del día ---------- */

const SVG_NS = "http://www.w3.org/2000/svg";
function svg(tag, attrs = {}, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  children.forEach((c) => el.append(c));
  return el;
}

let waveId = 0;

/**
 * El día como una curva: la onda dorada es tu energía (se hunde si marcaste cansancio),
 * debajo van los horarios fijos (rayado) y las tareas (terracota), y el punto es "ahora".
 * @param {object} profile  perfil con la curva efectiva
 * @param {object} day      día del plan
 * @param {Date} now
 * @param {{ showNow?: boolean, compact?: boolean, checkin?: object|null }} [opts]
 */
export function dayStrip(profile, day, now, { showNow = true, compact = false, checkin = null } = {}) {
  const id = `w${(waveId += 1)}`;
  const wake = parseHM(profile.wake);
  let sleep = parseHM(profile.sleep);
  if (sleep <= wake) sleep += 1440;
  const span = sleep - wake;
  const pct = (m) => Math.max(0, Math.min(100, ((m - wake) / span) * 100));

  const date = new Date(day.date + "T00:00:00");
  const curve = isWeekend(date) ? profile.energy.weekend : profile.energy.weekday;
  const W = 1000;
  const H = 100;
  const yOf = (e) => H - 8 - ((Math.min(5, Math.max(1, e)) - 1) / 4) * (H - 24); // 1 abajo, 5 arriba
  const xOf = (m) => ((m - wake) / span) * W;
  const valueAt = (m, withCheckin) => {
    const e = energyInterp(curve, m % 1440);
    return withCheckin && checkin ? e + checkinShift(profile, date, m % 1440, checkin) : e;
  };
  const pathFor = (withCheckin) => {
    const pts = [];
    for (let m = wake; m <= sleep; m += 15) pts.push(`${xOf(m).toFixed(1)} ${yOf(valueAt(m, withCheckin)).toFixed(1)}`);
    return "M" + pts.join(" L");
  };

  const line = pathFor(true);
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const grid = [];
  for (let hour = Math.ceil(wake / 180) * 3; hour * 60 < sleep; hour += 3) grid.push(svg("line", { x1: xOf(hour * 60), x2: xOf(hour * 60), y1: 0, y2: H, class: "w-grid" }));

  const chart = svg(
    "svg",
    { class: "wave-svg", viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", "aria-hidden": "true" },
    svg("defs", {}, svg("linearGradient", { id: `${id}-g`, x1: 0, x2: 0, y1: 0, y2: 1 }, svg("stop", { offset: "0%", "stop-color": "rgb(var(--sun))", "stop-opacity": 0.6 }), svg("stop", { offset: "100%", "stop-color": "rgb(var(--sun))", "stop-opacity": 0.05 }))),
    ...grid,
    svg("path", { d: area, fill: `url(#${id}-g)` }),
    checkin ? svg("path", { d: pathFor(false), class: "w-base" }) : null,
    svg("path", { d: line, class: "w-line", pathLength: 1 })
  );

  const lane = h("div", { class: "lane" });
  for (const it of day.items) {
    if (it.type === "break") continue;
    const left = pct(it.start);
    const width = pct(it.end) - left;
    if (width <= 0) continue;
    lane.append(h("div", { class: `seg ${it.type === "fixed" ? "fixed" : `task ${it.effort === "light" ? "light" : ""}`}`, style: `left:${left}%;width:${width}%` }));
  }

  const wave = h("div", { class: `wave ${compact ? "compact" : ""}`, role: "img", "aria-label": "Tu día: energía, horarios fijos y tareas" }, h("div", { class: "curvebox" }, chart), lane);

  if (showNow) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const m = nowMin < wake ? nowMin + 1440 : nowMin;
    if (m >= wake && m <= sleep) {
      const e = valueAt(m, true);
      wave.append(h("div", { class: "nowline", style: `left:${pct(m)}%` }));
      wave.querySelector(".curvebox").append(h("span", { class: "nowdot", style: `left:${pct(m)}%;top:${(yOf(e) / H) * 100}%` }));
    }
  }

  const out = h("div", { class: "wave-wrap" }, wave);
  if (!compact) {
    const ticks = h("div", { class: "strip-ticks" });
    for (let hour = Math.ceil(wake / 180) * 3; hour * 60 <= sleep; hour += 3) ticks.append(h("span", { style: `left:${pct(hour * 60)}%` }, String(hour % 24)));
    out.append(
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
  return out;
}

/** Energía estimada ahora (1 a 5), con el check-in reciente incluido. */
export function energyNow(profile, now, checkin) {
  const date = now;
  const curve = isWeekend(date) ? profile.energy.weekend : profile.energy.weekday;
  const m = now.getHours() * 60 + now.getMinutes();
  const e = energyInterp(curve, m) + (checkin ? checkinShift(profile, date, m, checkin) : 0);
  return Math.min(5, Math.max(1, e));
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
  const start = timeField(b.start);
  const end = timeField(b.end);
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
  const start = timeField(b.start);
  const end = timeField(b.end);
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
