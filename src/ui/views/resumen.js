// Resumen de los últimos 7 días: qué lograste, cuándo rendís mejor y qué ajustes sugiere la app.

import { h, dur, DAY_SHORT } from "../dom.js";
import { app } from "../state.js";
import { weeklySummary } from "../../engine/summary.js";

export function renderResumen() {
  const s = weeklySummary(app.profile, app.tasks, app.checkins, app.now);
  const root = h("div");

  root.append(
    h("div", { class: "eyebrow" }, "Tus últimos 7 días"),
    h(
      "div",
      { class: "stats" },
      stat(String(s.completed), s.completed === 1 ? "tarea hecha" : "tareas hechas"),
      stat(s.completedMinutes ? dur(s.completedMinutes) : "—", "dedicadas"),
      stat(s.avgEnergy ? String(s.avgEnergy).replace(".", ",") : "—", "energía media")
    ),
    daysChart(s)
  );

  root.append(h("div", { class: "eyebrow" }, "Cuándo rendís mejor"));
  if (s.checkins < 5) {
    root.append(h("p", { class: "muted small" }, `Llevo ${s.checkins} ${s.checkins === 1 ? "check-in" : "check-ins"} esta semana. Con unos pocos más empiezo a ver tu patrón real; mientras tanto uso lo que me contaste.`));
  }
  root.append(curveChart("Entre semana", s.learned.weekday, s.declaredBest.weekday, s.best.weekday, app.profile.energy.weekday));
  root.append(curveChart("Fin de semana", s.learned.weekend, s.declaredBest.weekend, s.best.weekend, app.profile.energy.weekend));
  root.append(h("p", { class: "muted small" }, "Las barras son tu energía según tus check-ins; la marca fina es lo que habías declarado."));

  if (s.suggestions.length) {
    root.append(h("div", { class: "eyebrow" }, "Ajustes que sugiero"));
    s.suggestions.forEach((t) => root.append(h("div", { class: "note" }, t)));
  }
  return root;
}

function stat(value, label) {
  return h("div", { class: "stat" }, h("b", null, value), h("span", null, label));
}

function daysChart(s) {
  const max = Math.max(1, ...s.perDay.map((d) => d.count));
  return h(
    "div",
    { class: "daybars", role: "img", "aria-label": "Tareas hechas por día" },
    s.perDay.map((d, i) =>
      h(
        "div",
        { class: `daybar ${i === 6 ? "today" : ""}` },
        h("span", { class: "n" }, d.count || ""),
        h("i", { style: `height:${Math.max(4, (d.count / max) * 100)}%`, class: d.count ? "" : "zero" }),
        h("span", { class: "d" }, DAY_SHORT[d.dow][0])
      )
    )
  );
}

function curveChart(title, learned, declaredBest, best, declared) {
  const bars = h("div", { class: "curve" });
  learned.forEach((v, hour) => {
    const inBest = best && (hour === best.from || hour === (best.from + 1) % 24);
    bars.append(
      h(
        "div",
        { class: `cbar ${inBest ? "best" : ""}`, title: `${hour}:00` },
        h("i", { style: `height:${(v / 5) * 100}%` }),
        h("em", { style: `bottom:${(declared[hour] / 5) * 100}%` })
      )
    );
  });
  return h(
    "div",
    { class: "curve-wrap" },
    h("div", { class: "curve-title" }, h("b", null, title), best && h("span", { class: "muted small" }, ` · mejor de ${best.from} a ${best.to} h`)),
    bars,
    h("div", { class: "bar-hours" }, ["0", "6", "12", "18", "23"].map((x) => h("span", null, x)))
  );
}
