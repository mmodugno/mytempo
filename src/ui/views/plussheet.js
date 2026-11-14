// La hoja de "mytempo Plus": qué incluye y un botón para decir que te interesa.
// Todavía no se cobra nada: el precio llega con la versión de Google Play.

import { h } from "../dom.js";
import { openSheet, closeSheet, toast } from "../components.js";
import { toggle } from "../controls.js";
import { PLUS_FEATURES } from "../../engine/plus.js";
import { PLUS_PRICE_TEXT } from "../../config.js";
import { isPlus, setPlus, demoAllowed, track } from "../plus.js";
import { emit } from "../state.js";

/** @param {"ajustes"|"vestidor"|"resumen"} from  desde dónde se abrió (solo para contar) */
export function openPlusSheet(from = "ajustes") {
  track("plus_open", { from });
  const active = isPlus();
  const rows = PLUS_FEATURES.map((f) =>
    h("li", { class: "plus-row" }, h("b", null, f.label), h("small", null, f.ready ? f.hint : `${f.hint} · próximamente`))
  );
  const demo = demoAllowed()
    ? toggle({
        checked: active,
        label: "Modo prueba",
        hint: "Solo para probar la app: activa Plus gratis. No existe en la versión de la tienda.",
        onChange: (v) => {
          setPlus(v, "demo");
          if (v) track("plus_demo_on");
          closeSheet();
          emit();
          toast(v ? "Plus activado (modo prueba)." : "Plus desactivado.");
        },
      })
    : null;

  openSheet(
    h("h2", null, "mytempo Plus"),
    h("p", { class: "muted" }, active ? "Tenés Plus. ¡Gracias por apoyar mytempo!" : "Todo lo de siempre sigue gratis. Plus suma extras y ayuda a que la app siga creciendo."),
    h("ul", { class: "plus-list" }, rows),
    !active && h("p", { class: "plus-price" }, PLUS_PRICE_TEXT),
    demo,
    h(
      "div",
      { class: "actions" },
      !active && h("button", { class: "btn primary", onclick: () => (track("plus_interest", { from }), closeSheet(), toast("¡Gracias! Te aviso cuando esté disponible.")) }, "Me interesa"),
      h("button", { class: "btn quiet", onclick: closeSheet }, "Cerrar")
    )
  );
}
