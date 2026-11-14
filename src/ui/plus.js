// Estado de mytempo Plus en el dispositivo + métricas locales/anónimas.
// El acceso a Plus NO va dentro del perfil: así un respaldo importado no puede "regalar" Plus.
// Cuando exista la compra real, `setPlus(true, "play")` lo llama el plugin de Google Play al verificar la compra.

import { bump, buildPayload } from "../engine/plus.js";
import { METRICS_URL } from "../config.js";
import { ymd } from "../engine/time.js";

const PLUS_KEY = "mytempo.plus";
const METRICS_KEY = "mytempo.metrics";

const read = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
};

export const isPlus = () => read(PLUS_KEY, {}).on === true;

export function setPlus(on, source = "play") {
  if (on) localStorage.setItem(PLUS_KEY, JSON.stringify({ on: true, source, at: new Date().toISOString() }));
  else localStorage.removeItem(PLUS_KEY);
}

/**
 * El modo prueba (Plus gratis para probar la app) solo existe en la web: en localhost o con ?plusdemo en la dirección.
 * Dentro de la app de Android (Capacitor, que también corre en "localhost") NUNCA existe.
 */
export const demoAllowed = () => !globalThis.Capacitor && (location.hostname === "localhost" || location.hostname === "127.0.0.1" || new URLSearchParams(location.search).has("plusdemo"));

/* ---------- Métricas ---------- */

export const getMetrics = () => ({ consent: false, counts: {}, ...read(METRICS_KEY, {}) });

export function setConsent(consent) {
  localStorage.setItem(METRICS_KEY, JSON.stringify({ ...getMetrics(), consent }));
}

/**
 * Cuenta un evento en el teléfono. Solo si la persona dio su permiso Y hay una dirección configurada, se envía
 * (solo el nombre del evento y el día: ver buildPayload).
 */
export function track(event, props = {}) {
  const payload = buildPayload(event, props, ymd(new Date()));
  if (!payload) return;
  const m = getMetrics();
  localStorage.setItem(METRICS_KEY, JSON.stringify({ ...m, counts: bump(m.counts, event, payload.feature) }));
  // (en modo prueba se puede apuntar a otra dirección guardándola en "mytempo.metricsUrl"; en producción manda config.js)
  const url = METRICS_URL || (demoAllowed() ? localStorage.getItem("mytempo.metricsUrl") : "");
  if (m.consent && url) {
    try {
      const body = JSON.stringify(payload);
      if (!navigator.sendBeacon?.(url, body)) fetch(url, { method: "POST", body, keepalive: true, headers: { "content-type": "text/plain" } }).catch(() => {});
    } catch {
      /* las métricas nunca tienen que romper la app */
    }
  }
}
