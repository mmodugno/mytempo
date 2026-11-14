// Mover una tarea a mano: elegís el día y la hora, y el resto del plan se acomoda alrededor.

import { h, timeField, hm, DAY_SHORT } from "../dom.js";
import { openSheet, closeSheet, toast } from "../components.js";
import { tiles } from "../controls.js";
import { app, getPlan, moveTask, unpinTask } from "../state.js";
import { parseHM } from "../../engine/time.js";

/** Huecos libres [inicio, fin) del día, sin contar la tarea que se está moviendo. */
export function freeGaps(day, profile, ignoreTaskId) {
  const wake = parseHM(profile.wake);
  let sleep = parseHM(profile.sleep);
  if (sleep <= wake) sleep += 1440;
  const busy = day.items
    .filter((i) => i.type !== "break" && i.taskId !== ignoreTaskId)
    .map((i) => [i.start, i.end])
    .sort((a, b) => a[0] - b[0]);
  const gaps = [];
  let cursor = wake;
  for (const [s, e] of busy) {
    if (s > cursor) gaps.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (sleep > cursor) gaps.push([cursor, sleep]);
  return gaps.filter(([s, e]) => e - s >= 10);
}

const dayLabel = (day, i) => (i === 0 ? "Hoy" : i === 1 ? "Mañana" : `${DAY_SHORT[day.dow]} ${Number(day.date.slice(8))}`);

/**
 * @param {object} task    la tarea a mover
 * @param {{date?: string, start?: number}} [from] dónde está ahora en el plan
 */
export function openMoveSheet(task, from = {}) {
  const plan = getPlan();
  let date = task.pin?.date ?? from.date ?? plan.days[0].date;
  if (!plan.days.some((d) => d.date === date)) date = plan.days[0].date;
  const startMin = task.pin?.start ?? from.start ?? 9 * 60;
  const time = timeField(`${String(Math.floor(startMin / 60) % 24).padStart(2, "0")}:${String(startMin % 60).padStart(2, "0")}`, { onchange: () => info() });
  const free = h("p", { class: "muted small" });
  const warn = h("p", { class: "small", style: "color:var(--accent);min-height:1.2em", role: "status" });
  const minutes = from.end != null && from.start != null ? from.end - from.start : (task.minutes ?? 30);

  const info = () => {
    const day = plan.days.find((d) => d.date === date);
    const gaps = freeGaps(day, app.profile, task.id);
    free.textContent = gaps.length ? `Libre ese día: ${gaps.slice(0, 4).map(([s, e]) => `${hm(s)}–${hm(e)}`).join(" · ")}` : "Ese día está lleno.";
    const s = parseHM(time.value);
    const clash = day.items.find((i) => i.type !== "break" && i.taskId !== task.id && s < i.end && s + minutes > i.start);
    warn.textContent = clash ? `Ojo: se pisa con «${clash.title}» (${hm(clash.start)}–${hm(clash.end)}).` : "";
  };

  const days = tiles({
    options: plan.days.map((d, i) => ({ value: d.date, label: dayLabel(d, i) })),
    value: date,
    columns: 3,
    label: "Día",
    onChange: (v) => ((date = v), info()),
  });
  info();

  openSheet(
    h("h2", null, "Mover tarea"),
    h("p", { class: "muted" }, task.title),
    h("div", { class: "field" }, h("span", { class: "lbl" }, "Día"), days),
    h("div", { class: "field" }, h("span", { class: "lbl" }, "A qué hora"), time, free),
    warn,
    h(
      "div",
      { class: "actions" },
      h("button", { class: "btn primary", onclick: () => (moveTask(task.id, date, parseHM(time.value)), closeSheet(), toast(`Listo, la dejé a las ${time.value}.`)) }, "Mover acá"),
      task.pin && h("button", { class: "btn", onclick: () => (unpinTask(task.id), closeSheet(), toast("Vuelvo a acomodarla yo.")) }, "Que la acomode la app"),
      h("button", { class: "btn quiet", onclick: closeSheet }, "Cancelar")
    )
  );
}
