// Helpers mínimos de DOM y formato. Sin framework.

import { formatHM } from "../engine/time.js";

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (k.startsWith("aria-") && typeof v === "boolean") {
      el.setAttribute(k, String(v)); // aria-pressed="false" también tiene que existir
      continue;
    }
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "style" && typeof v === "string") el.setAttribute("style", v);
    else if (k in el && k !== "list") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

/**
 * Selector de hora en 24 h (hora : minutos de 5 en 5). Reemplaza a <input type="time">,
 * que cada celular dibuja distinto (AM/PM, reloj de aguja, etc.).
 * Se usa como un input: `.value` ("HH:MM") y el evento `change`.
 */
export function timeField(value = "09:00", props = {}) {
  const pad = (n) => String(n).padStart(2, "0");
  let [hh, mm] = value.split(":").map(Number);
  const hours = h("select", { "aria-label": "Hora", class: "tf-h" });
  const mins = h("select", { "aria-label": "Minutos", class: "tf-m" });
  for (let i = 0; i < 24; i++) hours.append(h("option", { value: pad(i) }, pad(i)));
  const fill = () => {
    mins.replaceChildren();
    const steps = new Set(Array.from({ length: 12 }, (_, i) => i * 5));
    steps.add(mm); // si viene un minuto raro (ej. importado), no lo perdemos
    [...steps].sort((a, b) => a - b).forEach((m) => mins.append(h("option", { value: pad(m) }, pad(m))));
    mins.value = pad(mm);
  };
  fill();
  hours.value = pad(hh);
  const wrap = h("div", { class: "timefield", role: "group", ...props }, hours, h("span", { "aria-hidden": "true" }, ":"), mins);
  Object.defineProperty(wrap, "value", {
    get: () => `${hours.value}:${mins.value}`,
    set: (v) => {
      [hh, mm] = v.split(":").map(Number);
      hours.value = pad(hh);
      fill();
    },
  });
  return wrap;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export const hm = formatHM;

export function dur(min) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m}` : `${h} h`;
}

export const DAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const DAY_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
export const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export const EFFORT_LABEL = { light: "liviana", medium: "media", hard: "exigente" };

export function shortDate(ymdStr) {
  const [y, m, d] = ymdStr.split("-").map(Number);
  return `${DAY_SHORT[new Date(y, m - 1, d).getDay()]} ${d} ${MONTHS[m - 1]}`;
}
