// Controles de selección: todos comparten forma, tamaño de toque (≥44 px) y teclado.
// Cada uno devuelve un elemento con `.set(valor)`; el estado vive adentro y avisa con onChange(valor).

import { h, DAY_SHORT, dur } from "./dom.js";
import { ymd, parseYMD, addDays, startOfDay } from "../engine/time.js";

const sameVal = (a, b) => (a ?? null) === (b ?? null);

/** Flechas izquierda/derecha entre las opciones de un grupo (patrón de radiogroup). */
function roving(group, selector) {
  group.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    const items = [...group.querySelectorAll(selector)];
    const i = items.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const next = items[(i + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1) + items.length) % items.length];
    next.focus();
    next.click();
  });
}

/**
 * Control segmentado: una sola fila de opciones de igual ancho con una "pastilla" que se desliza.
 * Para 2 a 5 opciones cortas (esfuerzo, prioridad, duración rápida…).
 * @param {{options: {value: any, label: string, dot?: string}[], value: any, onChange: (v:any)=>void, label: string, compact?: boolean}} cfg
 */
export function segmented({ options, value, onChange, label, compact = false }) {
  const root = h("div", { class: `segmented ${compact ? "compact" : ""}`, role: "radiogroup", "aria-label": label, style: `--n:${options.length}` });
  const thumb = h("span", { class: "seg-thumb", "aria-hidden": "true" });
  const buttons = options.map((o) =>
    h(
      "button",
      { type: "button", class: "seg-opt", role: "radio", onclick: () => set(o.value, true) },
      o.dot && h("i", { class: `seg-dot ${o.dot}`, "aria-hidden": "true" }),
      o.label
    )
  );
  root.append(thumb, ...buttons);
  function set(v, notify = false) {
    value = v;
    const idx = options.findIndex((o) => sameVal(o.value, v));
    root.style.setProperty("--i", String(Math.max(idx, 0)));
    root.classList.toggle("none", idx < 0);
    buttons.forEach((b, i) => {
      b.setAttribute("aria-checked", String(i === idx));
      b.tabIndex = i === idx || (idx < 0 && i === 0) ? 0 : -1;
    });
    if (notify) onChange(v);
  }
  roving(root, ".seg-opt");
  set(value);
  root.set = set;
  return root;
}

/**
 * Tarjetas de opción (radio): para listas de 4 a 6 opciones o con texto más largo.
 * @param {{options: {value: any, label: string, hint?: string, wide?: boolean}[], value: any, onChange: (v:any)=>void, label: string, columns?: number}} cfg
 */
export function tiles({ options, value, onChange, label, columns = 2 }) {
  const root = h("div", { class: "tiles", role: "radiogroup", "aria-label": label, style: `--cols:${columns}` });
  const buttons = options.map((o) =>
    h(
      "button",
      { type: "button", class: `tile ${o.wide ? "wide" : ""}`, role: "radio", onclick: () => set(o.value, true) },
      h("span", { class: "tile-check", "aria-hidden": "true" }),
      h("span", { class: "tile-text" }, h("b", null, o.label), o.hint && h("small", null, o.hint))
    )
  );
  root.append(...buttons);
  function set(v, notify = false) {
    value = v;
    options.forEach((o, i) => {
      const on = sameVal(o.value, v);
      buttons[i].setAttribute("aria-checked", String(on));
      buttons[i].classList.toggle("on", on);
      buttons[i].tabIndex = on || (!options.some((x) => sameVal(x.value, v)) && i === 0) ? 0 : -1;
    });
    if (notify) onChange(v);
  }
  roving(root, ".tile");
  set(value);
  root.set = set;
  return root;
}

/** Duración: botones − y + con el valor grande en el medio. Pasos de 5 min (15 desde 1 h, 30 desde 3 h). */
export function stepper({ value, min = 5, max = 480, onChange, label = "Duración" }) {
  const stepAt = (v, dir) => {
    const x = dir < 0 ? v - 1 : v;
    return x < 60 ? 5 : x < 180 ? 15 : 30;
  };
  const out = h("output", { class: "stepper-value", "aria-live": "polite" });
  const minus = h("button", { type: "button", class: "stepper-btn", "aria-label": `Menos ${label.toLowerCase()}`, onclick: () => bump(-1) }, "−");
  const plus = h("button", { type: "button", class: "stepper-btn", "aria-label": `Más ${label.toLowerCase()}`, onclick: () => bump(1) }, "+");
  const root = h("div", { class: "stepper", role: "group", "aria-label": label }, minus, out, plus);
  function bump(dir) {
    const next = Math.max(min, Math.min(max, Math.round((value + dir * stepAt(value, dir)) / 5) * 5));
    if (next !== value) set(next, true);
  }
  function set(v, notify = false) {
    value = v;
    out.textContent = dur(v);
    minus.disabled = v <= min;
    plus.disabled = v >= max;
    if (notify) onChange(v);
  }
  set(value);
  root.set = set;
  return root;
}

/** Interruptor con título y una línea de ayuda. */
export function toggle({ checked, label, hint, onChange }) {
  const btn = h(
    "button",
    { type: "button", class: "switch-row", role: "switch", onclick: () => set(!checked, true) },
    h("span", { class: "switch-text" }, h("b", null, label), hint && h("small", null, hint)),
    h("span", { class: "switch", "aria-hidden": "true" }, h("i"))
  );
  function set(v, notify = false) {
    checked = v;
    btn.setAttribute("aria-checked", String(v));
    btn.classList.toggle("on", v);
    if (notify) onChange(v);
  }
  set(checked);
  btn.set = set;
  return btn;
}

/** Siete botones redondos (L M M J V S D) con atajos. Los días son 0 = domingo … 6 = sábado. */
export function dayPicker({ days, onChange }) {
  const ORDER = [1, 2, 3, 4, 5, 6, 0];
  const LETTER = { 0: "D", 1: "L", 2: "M", 3: "M", 4: "J", 5: "V", 6: "S" };
  const row = h("div", { class: "daypick" });
  const buttons = ORDER.map((d) => h("button", { type: "button", class: "dayp", "aria-label": DAY_SHORT[d], onclick: () => toggleDay(d) }, LETTER[d]));
  row.append(...buttons);
  const PRESETS = [
    ["Lun a vie", [1, 2, 3, 4, 5]],
    ["Fin de semana", [6, 0]],
    ["Todos", [0, 1, 2, 3, 4, 5, 6]],
  ];
  const presets = h(
    "div",
    { class: "daypresets" },
    PRESETS.map(([label, set]) => h("button", { type: "button", class: "preset", onclick: () => set_(set, true) }, label))
  );
  const root = h("div", { class: "daypicker" }, row, presets);
  function toggleDay(d) {
    set_(days.includes(d) ? days.filter((x) => x !== d) : [...days, d], true);
  }
  function set_(v, notify = false) {
    days = [...v];
    buttons.forEach((b, i) => {
      const on = days.includes(ORDER[i]);
      b.classList.toggle("on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    [...presets.children].forEach((b, i) => b.classList.toggle("on", PRESETS[i][1].length === days.length && PRESETS[i][1].every((d) => days.includes(d))));
    if (notify) onChange(days);
  }
  set_(days);
  root.set = set_;
  return root;
}

/**
 * Fecha con atajos (Hoy, Mañana, Este finde…) y el calendario del teléfono solo si hace falta.
 * @param {{value: string|null, onChange: (v:string|null)=>void, allowNone?: boolean, today: Date}} cfg
 */
export function quickDate({ value, onChange, allowNone = true, today = new Date() }) {
  const t0 = startOfDay(today);
  const sat = addDays(t0, (6 - t0.getDay() + 7) % 7 || 7);
  const quick = [
    ...(allowNone ? [{ value: null, label: "Sin fecha" }] : []),
    { value: ymd(t0), label: "Hoy" },
    { value: ymd(addDays(t0, 1)), label: "Mañana" },
    { value: ymd(sat), label: "Este finde" },
  ];
  const input = h("input", { type: "date", value: value ?? "", "aria-label": "Elegir fecha", onchange: () => commit(input.value || null) });
  const group = tiles({
    options: [...quick, { value: "__other", label: "Elegir" }],
    value: "__other",
    columns: 3,
    label: "Fecha",
    onChange: (v) => (v === "__other" ? (input.parentElement.hidden = false, input.focus()) : commit(v)),
  });
  const pick = h("div", { class: "date-pick" }, input);
  const root = h("div", { class: "quickdate" }, group, pick);
  function commit(v) {
    value = v;
    sync();
    onChange(v);
  }
  function sync() {
    const isQuick = quick.some((o) => sameVal(o.value, value));
    group.set(isQuick ? value : "__other");
    pick.hidden = isQuick;
    input.value = value && !isQuick ? value : isQuick ? "" : (value ?? "");
  }
  sync();
  root.set = (v) => ((value = v), sync());
  return root;
}

export { parseYMD };
