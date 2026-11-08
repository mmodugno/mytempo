// Carga rápida: "Estudiar módulo 3 1h30 mañana !" -> tarea con duración, fecha límite y prioridad.
// Todo lo que no se reconoce queda como título. Los datos son siempre opcionales.

import { addDays, ymd } from "./time.js";

const DAYS = {
  domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3, jueves: 4, viernes: 5, sabado: 6, sábado: 6,
};

const REPEATS = [
  ["2weeks", /\s(cada 2 semanas|cada dos semanas|quincenal)(?=\s)/i],
  ["week", /\s(cada semana|todas las semanas|semanal)(?=\s)/i],
  ["month", /\s(cada mes|todos los meses|mensual)(?=\s)/i],
  ["day", /\s(todos los dias|cada dia|diari[oa])(?=\s)/i],
];

const strip = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * @param {string} text
 * @param {Date} now
 * @returns {{ title: string, minutes?: number, due?: string, priority?: number, effort?: string, repeat?: string }}
 */
export function parseQuickTask(text, now = new Date()) {
  let rest = ` ${text.trim()} `;
  const out = {};

  // Duración: 45m, 45 min, 2h, 1h30, 1,5h
  rest = rest.replace(/\s(\d+(?:[.,]\d+)?)\s?h(?:s|oras?)?\s?(\d{1,2})?\s?(?:m|min)?(?=\s)/i, (_, h, m) => {
    out.minutes = Math.round(parseFloat(h.replace(",", ".")) * 60) + (m ? Number(m) : 0);
    return " ";
  });
  if (out.minutes === undefined) {
    rest = rest.replace(/\s(\d{1,3})\s?(?:m|min|mins|minutos)(?=\s)/i, (_, m) => {
      out.minutes = Number(m);
      return " ";
    });
  }

  // Prioridad alta con "!" al final o suelto
  if (/\s!+\s*$/.test(rest) || /\s!\s/.test(rest)) {
    out.priority = 3;
    rest = rest.replace(/\s!+(?=\s)/g, " ");
  }

  // Esfuerzo con #liviana #media #exigente
  rest = rest.replace(/\s#(liviana|media|exigente)(?=\s)/i, (_, e) => {
    out.effort = { liviana: "light", media: "medium", exigente: "hard" }[e.toLowerCase()];
    return " ";
  });

  // Repetición: todos los días, cada semana, cada 2 semanas, cada mes (en ese orden, de lo más específico a lo general)
  for (const [repeat, re] of REPEATS) {
    const m = strip(rest).match(re);
    if (m) {
      out.repeat = repeat;
      rest = rest.slice(0, m.index) + " " + rest.slice(m.index + m[0].length);
      break;
    }
  }

  // Fecha límite: hoy, mañana, o un día de la semana (el próximo que venga)
  const dayMatch = strip(rest).match(/\s(hoy|manana|domingo|lunes|martes|miercoles|jueves|viernes|sabado)(?=\s)/i);
  if (dayMatch) {
    const word = dayMatch[1].toLowerCase();
    if (word === "hoy") out.due = ymd(now);
    else if (word === "manana") out.due = ymd(addDays(now, 1));
    else {
      const target = DAYS[word];
      const ahead = ((target - now.getDay() + 7) % 7) || 7;
      out.due = ymd(addDays(now, ahead));
    }
    // quitamos la palabra del título (mismo largo gracias a strip sin acentos 1 a 1)
    const idx = dayMatch.index;
    rest = rest.slice(0, idx) + " " + rest.slice(idx + dayMatch[0].length);
  }

  out.title = rest.replace(/\s+/g, " ").trim();
  return out;
}
