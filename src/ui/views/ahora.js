// Pantalla principal: qué hacer ahora y lo que sigue. Sin la lista completa.

import { h, hm, dur, EFFORT_LABEL, DAY_LONG } from "../dom.js";
import { app, getPlan, effective, activeCheckin, toggleSubtask, answerDuration, dismissDuration, checkinDue, addCheckin, setFocusOnLastCheckin, snoozeCheckin, completeTask, snoozeTask, skipToday } from "../state.js";
import { dayStrip, energyNow, toast } from "../components.js";
import { parseHM, minutesOfDay } from "../../engine/time.js";
import { petCard } from "./pet.js";

export function renderAhora() {
  const plan = getPlan();
  const today = plan.days[0];
  const now = app.now;
  const nowMin = minutesOfDay(now);
  const wake = parseHM(app.profile.wake);
  let sleep = parseHM(app.profile.sleep);
  if (sleep <= wake) sleep += 1440;
  const awake = (nowMin >= wake && nowMin < sleep) || nowMin < sleep - 1440;

  const current = today.items.find((i) => i.type !== "break" && i.start <= nowMin && nowMin < i.end);
  const upcoming = today.items.filter((i) => i.type !== "break" && i.start > nowMin);
  const nextTask = upcoming.find((i) => i.type === "task");

  const root = h("div");
  // Mientras Pompón festeja, va primero para que la reacción se vea sin hacer scroll.
  if (app.cheer) root.append(petCard(awake));
  const justDone = app.askDuration && app.tasks.find((t) => t.id === app.askDuration);
  if (justDone) root.append(durationCard(justDone));
  else if (askFocus || checkinDue()) root.append(checkinCard());
  const heroEl = hero({ awake, current, nextTask, today, nowMin });
  if (awake) {
    const level = Math.round(energyNow(effective(), now, activeCheckin()));
    heroEl.append(
      h("div", { class: "energy-now", role: "img", "aria-label": `Energía estimada ahora: ${level} de 5` }, h("span", null, "energía"), [1, 2, 3, 4, 5].map((n) => h("i", { class: n <= level ? "on" : "" })))
    );
  }
  root.append(heroEl);
  if (!app.cheer) root.append(petCard(awake));

  root.append(h("div", { class: "eyebrow" }, "Tu día"), dayStrip(effective(), today, now, { checkin: activeCheckin() }));

  // Si el hero ya muestra la próxima tarea, no la repetimos en la lista.
  const heroShowsNext = awake && current?.type !== "task" && nextTask;
  const rest = upcoming.filter((i) => i !== (heroShowsNext ? nextTask : null)).slice(0, 4);
  if (rest.length) {
    root.append(h("div", { class: "eyebrow" }, "Lo que sigue"));
    rest.forEach((i) => root.append(itemRow(i)));
  }

  if (plan.unplaced.length) {
    root.append(
      h(
        "div",
        { class: "note" },
        plan.unplaced.length === 1 ? "Una tarea no encontró lugar esta semana. " : `${plan.unplaced.length} tareas no encontraron lugar esta semana. `,
        "No pasa nada: mirá la pestaña Tareas para moverlas o cambiar la fecha."
      )
    );
  }
  return root;
}

function hero({ awake, current, nextTask, today, nowMin }) {
  const pendingToday = today.items.some((i) => i.type === "task" && i.end > nowMin);

  if (!awake) {
    return h("section", { class: "hero" }, h("div", { class: "label" }, "Descanso"), h("h1", null, "Ahora toca descansar."), h("div", { class: "meta" }, "Lo que quede lo acomodo yo para mañana."));
  }

  if (current?.type === "task") {
    const t = app.tasks.find((x) => x.id === current.taskId);
    const parts = current.total > 1 ? ` · parte ${current.part} de ${current.total}` : "";
    return h(
      "section",
      { class: "hero" },
      h("div", { class: "label" }, "Ahora"),
      h("h1", null, current.title),
      h("div", { class: "meta" }, `Hasta las ${hm(current.end)} · ${dur(current.end - current.start)} · ${EFFORT_LABEL[current.effort]}${parts}`),
      t.subtasks?.length ? checklist(t) : null,
      h(
        "div",
        { class: "actions" },
        h("button", { class: "btn primary", onclick: () => (completeTask(t.id)) }, "Hecha"),
        h("button", { class: "btn", onclick: () => ((snoozeTask(t.id), toast("Sin drama, la muevo para más tarde."))) }, "Más tarde"),
        h("button", { class: "btn quiet", onclick: () => ((skipToday(t.id), toast("La paso para mañana."))) }, "No hoy")
      )
    );
  }

  const where = current?.type === "fixed" ? h("div", { class: "meta" }, `Estás en: ${current.title}, hasta las ${hm(current.end)}.`) : null;

  if (nextTask) {
    const t = app.tasks.find((x) => x.id === nextTask.taskId);
    return h(
      "section",
      { class: "hero" },
      h("div", { class: "label" }, current?.type === "fixed" ? "Después" : "Tu próximo paso"),
      h("h1", null, nextTask.title),
      h("div", { class: "meta" }, `A las ${hm(nextTask.start)} · ${dur(nextTask.end - nextTask.start)} · ${EFFORT_LABEL[nextTask.effort]}`),
      where,
      h(
        "div",
        { class: "actions" },
        h("button", { class: "btn", onclick: () => ((skipToday(t.id), toast("La paso para mañana."))) }, "No hoy"),
        h("button", { class: "btn quiet", onclick: () => (completeTask(t.id)) }, "Ya la hice")
      )
    );
  }

  return h(
    "section",
    { class: "hero" },
    h("div", { class: "label" }, DAY_LONG[app.now.getDay()]),
    h("h1", null, pendingToday ? "Seguí con lo que estás haciendo." : "Por hoy ya está."),
    h("div", { class: "meta" }, app.tasks.some((t) => t.status === "todo") ? "Lo demás está acomodado en los próximos días. Disfrutá tu tiempo libre." : "No tenés tareas pendientes. Sumá una abajo cuando quieras."),
    where
  );
}

function itemRow(i) {
  const fixed = i.type === "fixed";
  return h(
    "div",
    { class: `row ${fixed ? "fixed" : ""}` },
    h("span", { class: "when" }, hm(i.start)),
    h("span", { class: "what" }, h("b", null, !fixed && h("span", { class: `dot ${i.effort}` }), i.title), h("span", { class: "sub" }, `${dur(i.end - i.start)}${fixed ? "" : ` · ${EFFORT_LABEL[i.effort]}`}`))
  );
}

/* ---------- Check-in de energía ---------- */

let askFocus = false;

function checkinCard() {
  if (askFocus) {
    return h(
      "div",
      { class: "checkin" },
      h("p", null, "¿Y el foco?"),
      scale((n) => {
        askFocus = false; // antes de guardar, porque guardar vuelve a dibujar la pantalla
        setFocusOnLastCheckin(n);
        toast("Gracias, anotado.");
      }),
      h("div", { class: "scale-labels" }, h("span", null, "disperso"), h("span", null, "concentrado")),
      h("button", { class: "skip", onclick: () => {
        askFocus = false;
        snoozeCheckin(4);
      } }, "Saltar")
    );
  }
  return h(
    "div",
    { class: "checkin" },
    h("p", null, "¿Cómo está tu energía ahora?"),
    scale((n) => {
      addCheckin(n);
      askFocus = true;
      toast(n <= 2 ? "Entendido, voy a cuidar tu energía." : "Anotado.");
    }),
    h("div", { class: "scale-labels" }, h("span", null, "bajita"), h("span", null, "a full")),
    h("button", { class: "skip", onclick: () => snoozeCheckin(1) }, "Ahora no")
  );
}

function scale(onPick) {
  return h("div", { class: "scale" }, [1, 2, 3, 4, 5].map((n) => h("button", { onclick: () => onPick(n), "aria-label": `${n} de 5` }, String(n))));
}

function checklist(task) {
  return h(
    "div",
    { class: "checklist" },
    task.subtasks.map((s) =>
      h(
        "button",
        { class: `sub-row ${s.done ? "is-done" : ""}`, onclick: () => toggleSubtask(task.id, s.id), "aria-pressed": s.done },
        h("span", { class: `check ${s.done ? "on" : ""}` }, s.done ? "✓" : ""),
        h("span", { class: s.done ? "done" : "" }, s.title)
      )
    )
  );
}

/* ---------- ¿Cuánto tardó? ---------- */

function durationCard(task) {
  return h(
    "div",
    { class: "checkin" },
    h("p", null, `¿Cuánto tardó «${task.title}»?`),
    h(
      "div",
      { class: "actions", style: "margin:0" },
      h("button", { class: "btn", onclick: () => answerDuration(task.id, "menos") }, "Menos"),
      h("button", { class: "btn", onclick: () => answerDuration(task.id, "previsto") }, `Lo previsto (${dur(task.minutes)})`),
      h("button", { class: "btn", onclick: () => answerDuration(task.id, "mas") }, "Más")
    ),
    h("button", { class: "skip", onclick: dismissDuration }, "Saltar")
  );
}
