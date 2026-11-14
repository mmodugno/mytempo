// La semana completa, día por día.

import { h, hm, dur, shortDate, DAY_LONG } from "../dom.js";
import { getPlan, app, effective, activeCheckin } from "../state.js";
import { dayStrip } from "../components.js";
import { openOneOff } from "./oneoff.js";
import { openMoveSheet } from "./movesheet.js";

export function renderSemana() {
  const plan = getPlan();
  const root = h("div");
  root.append(h("button", { class: "btn block", style: "margin:8px 0 0", onclick: () => openOneOff() }, "+ Compromiso de un día"));
  plan.days.forEach((day, idx) => {
    const items = day.items.filter((i) => i.type !== "break");
    const section = h(
      "section",
      { class: `day ${idx === 0 ? "is-today" : ""}` },
      h("h3", null, idx === 0 ? "Hoy" : cap(DAY_LONG[day.dow]), h("small", null, shortDate(day.date).split(" ").slice(1).join(" "), ` · libre ${dur(Math.max(0, day.freeMinutes))}`))
    );
    section.append(dayStrip(effective(), day, app.now, { showNow: idx === 0, compact: true, checkin: idx === 0 ? activeCheckin() : null }));
    if (!items.length) section.append(h("div", { class: "row" }, h("span", { class: "what muted" }, "Día libre")));
    items.forEach((i) => {
      const fixed = i.type === "fixed";
      const editable = fixed && i.oneOffId;
      const block = editable ? (app.profile.oneOffBlocks ?? []).find((b) => b.id === i.oneOffId) : null;
      const task = !fixed ? app.tasks.find((t) => t.id === i.taskId) : null;
      const action = editable ? () => openOneOff(block) : task ? () => openMoveSheet(task, { date: day.date, start: i.start, end: i.end }) : null;
      const hint = editable ? " · tocá para editar" : task ? (i.pinned ? " · fijada, tocá para mover" : " · tocá para mover") : "";
      section.append(
        h(
          action ? "button" : "div",
          { class: `row ${fixed ? "fixed" : ""}`, onclick: action },
          h("span", { class: "when" }, hm(i.start)),
          h("span", { class: "what" }, h("b", null, !fixed && h("span", { class: `dot ${i.effort}` }), i.title), h("span", { class: "sub" }, `hasta ${hm(i.end)}${hint}`))
        )
      );
    });
    root.append(section);
  });
  return root;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
