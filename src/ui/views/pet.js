// La mascota en pantalla: tarjeta de "Ahora" (racha, reacción al completar) y bloque del Resumen.

import { h, DAY_SHORT } from "../dom.js";
import { app, stats, buyAccessory, wearAccessory } from "../state.js";
import { pomeranianSvg } from "../mascot.js";
import { nextAccessory } from "../../engine/streak.js";
import { ITEMS, coins, owns, wornItems, outfitFor, phrase } from "../../engine/pet.js";
import { parseYMD } from "../../engine/time.js";

const CHEERS = ["¡Bien ahí!", "¡Otra más!", "¡Eso es!", "¡Qué bien!"];
export const petName = () => app.profile.petName || "Pompón";
const days = (n) => `${n} ${n === 1 ? "día" : "días"}`;

function dog(mood, best, size) {
  const el = h("div", { class: `pet-dog ${mood === "happy" ? "cheer" : ""}`, style: `width:${size}px;height:${Math.round(size * 1.04)}px` });
  el.innerHTML = pomeranianSvg({ mood, outfit: outfitFor(best, app.profile.pet) });
  return el;
}

function dots(s) {
  return h(
    "div",
    { class: "days7", role: "img", "aria-label": `Últimos 7 días: ${s.last7.filter((d) => d.state === "done").length} cumplidos` },
    s.last7.map((d) => h("div", { class: `sd ${d.state}` }, h("i"), DAY_SHORT[parseYMD(d.date).getDay()][0]))
  );
}

function cheerText(c, s) {
  const name = petName();
  if (c.accessory) return `¡Racha de ${days(c.accessory.at)}! ${name} estrena: ${c.accessory.label.toLowerCase()}.`;
  if (c.levelUp) return `¡${name} subió al nivel ${s.level.level}!`;
  if (c.newDay && c.streak > 1) return `Racha de ${days(c.streak)}. ¡Seguimos!`;
  return CHEERS[(c.id?.charCodeAt(c.id.length - 1) ?? 0) % CHEERS.length];
}

/** Tarjeta de la pantalla "Ahora". */
export function petCard(awake) {
  const s = stats();
  const c = app.cheer;
  const mood = c ? "happy" : awake ? "calm" : "sleepy";

  let info;
  if (c) {
    info = h("div", { class: "pet-bubble", role: "status" }, h("b", null, `+${c.points} puntos`), h("span", null, cheerText(c, s)));
  } else if (s.current > 0) {
    info = h("div", null, h("div", { class: "pet-streak" }, String(s.current), h("small", null, s.current === 1 ? " día seguido" : " días seguidos")), h("div", { class: "pet-sub" }, phrase({ now: app.now, streak: s.current, todayDone: s.todayDone, awake })));
  } else {
    info = h("div", null, h("div", { class: "pet-streak small" }, s.best > 0 ? "Empezamos de nuevo" : "Tu racha empieza hoy"), h("div", { class: "pet-sub" }, phrase({ now: app.now, streak: 0, todayDone: s.todayDone, awake })));
  }

  return h(
    "section",
    { class: "pet", "aria-label": `${petName()}, tu mascota` },
    dog(mood, s.best, 76),
    h("div", { class: "pet-info" }, h("div", { class: "pet-name" }, petName()), info, h("div", { class: "pet-bar", "aria-hidden": "true" }, h("i", { style: `width:${Math.max(4, s.level.pct)}%` }))),
    dots(s),
    h("div", { class: "pet-level" }, `Nivel ${s.level.level} · ${s.total} puntos`)
  );
}

/** Bloque del Resumen: racha, récord, puntos y accesorios. */
export function petSummary() {
  const s = stats();
  const next = nextAccessory(s.best);
  const root = h("div");
  root.append(
    h("div", { class: "eyebrow" }, `${petName()} y tu racha`),
    h("div", { class: "pet-sum" }, dog("calm", s.best, 84), h("div", { class: "stats" }, stat(String(s.current), s.current === 1 ? "día seguido" : "días seguidos"), stat(String(s.best), "mejor racha"), stat(String(s.total), "puntos"))),
    dots(s),
    h("p", { class: "muted small" }, `Nivel ${s.level.level}: te faltan ${s.level.to - s.total} puntos para el ${s.level.level + 1}. ` + (s.restLeft > 0 ? "Tenés un día de descanso esta semana: no corta la racha." : s.restLeft === 0 && (app.profile.streakRest ?? 1) > 0 ? "Ya usaste el descanso de esta semana." : "")),
    closet(s)
  );
  if (next) root.append(h("p", { class: "muted small" }, `Próximo regalo por racha: ${next.label.toLowerCase()} con ${days(next.at)} seguidos.`));
  return root;
}

/** Vestidor: los de racha se ganan solos; los otros se compran con monedas. Tocar uno que tenés lo pone o lo saca. */
function closet(s) {
  const pet = app.profile.pet;
  const wallet = coins(s.total, pet);
  const worn = wornItems(s.best, pet);
  const note = h("p", { class: "muted small", role: "status" }, "");
  const redraw = () => root.replaceWith(closet(s));
  const root = h("div", { class: "closet" }, h("div", { class: "closet-head" }, h("b", null, "Vestidor"), h("span", { class: "coins" }, `${wallet} monedas`)), note);
  root.append(
    h(
      "div",
      { class: "accs" },
      ITEMS.map((it) => {
        const has = owns(it.id, s.best, pet);
        const on = worn.includes(it.id);
        const label = has ? it.label : it.streak != null ? `${it.label} · ${days(it.streak)}` : `${it.label} · ${it.cost}`;
        return h(
          "button",
          {
            type: "button",
            class: `acc ${has ? "on" : ""} ${on ? "worn" : ""}`,
            "aria-pressed": has ? String(on) : null,
            disabled: !has && it.streak != null ? true : null,
            onclick: () => {
              if (has) return wearAccessory(it.id);
              const r = buyAccessory(it.id);
              if (!r.ok) note.textContent = r.reason === "faltan-monedas" ? `Te faltan ${r.missing} monedas para ${it.label.toLowerCase()}.` : "";
            },
          },
          on ? `✓ ${label}` : label
        );
      })
    )
  );
  return root;
}

const stat = (value, label) => h("div", { class: "stat" }, h("b", null, value), h("span", null, label));
