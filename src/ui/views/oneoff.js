// Abrir/guardar/borrar compromisos de un solo día. Lo usan la pestaña Semana y Ajustes.

import { app, saveProfile } from "../state.js";
import { ymd } from "../../engine/time.js";
import { oneOffSheet, openSheet, closeSheet, toast } from "../components.js";

export function openOneOff(block = null, defaultDate = ymd(app.now)) {
  const p = app.profile;
  openSheet(
    ...oneOffSheet(block, defaultDate, {
      onSave: (b) => {
        p.oneOffBlocks = p.oneOffBlocks ?? [];
        const i = p.oneOffBlocks.findIndex((x) => x.id === b.id);
        if (i >= 0) p.oneOffBlocks[i] = b;
        else p.oneOffBlocks.push(b);
        saveProfile(p);
        closeSheet();
        toast("Anotado. Reacomodé tu semana.");
      },
      onDelete: (b) => {
        p.oneOffBlocks = p.oneOffBlocks.filter((x) => x.id !== b.id);
        saveProfile(p);
        closeSheet();
        toast("Compromiso borrado.");
      },
    })
  );
}

/** Compromisos de hoy en adelante, ordenados. */
export function upcomingOneOffs() {
  const today = ymd(app.now);
  return (app.profile.oneOffBlocks ?? []).filter((b) => b.date >= today).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}
