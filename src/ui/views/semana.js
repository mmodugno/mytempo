// La semana completa, día por día.

import { h, hm, dur, shortDate, DAY_LONG } from "../dom.js";
import { getPlan } from "../state.js";

export function renderSemana() {
  const plan = getPlan();
  const root = h("div");
  plan.days.forEach((day, idx) => {
    const items = day.items.filter((i) => i.type !== "break");
    const section = h(
      "section",
      { class: `day ${idx === 0 ? "is-today" : ""}` },
      h("h3", null, idx === 0 ? "Hoy" : cap(DAY_LONG[day.dow]), h("small", null, shortDate(day.date).split(" ").slice(1).join(" "), ` · libre ${dur(Math.max(0, day.freeMinutes))}`))
    );
    if (!items.length) section.append(h("div", { class: "row" }, h("span", { class: "what muted" }, "Día libre")));
    items.forEach((i) => {
      const fixed = i.type === "fixed";
      section.append(
        h(
          "div",
          { class: `row ${fixed ? "fixed" : ""}` },
          h("span", { class: "when" }, hm(i.start)),
          h("span", { class: "what" }, h("b", null, !fixed && h("span", { class: `dot ${i.effort}` }), i.title), h("span", { class: "sub" }, `hasta ${hm(i.end)}`))
        )
      );
    });
    root.append(section);
  });
  return root;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
