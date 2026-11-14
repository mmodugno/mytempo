// Utilidades de los tests de flujo: servidor estático local, navegador y una función para abrir la app con datos sembrados.

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium, devices } from "playwright";

export const ROOT = new URL("..", import.meta.url).pathname;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml" };

export const exampleProfile = JSON.parse(await readFile(join(ROOT, "data/perfil-ejemplo.json"), "utf8"));

/** El perfil de ejemplo sin tareas de rutina, para pruebas donde solo deben existir las tareas que se siembran. */
export const bareProfile = { ...exampleProfile, routine: [] };

export function startServer() {
  const server = createServer(async (req, res) => {
    try {
      const path = normalize(new URL(req.url, "http://x").pathname).replace(/^(\.\.[/\\])+/, "");
      const file = join(ROOT, path === "/" ? "index.html" : path);
      if (!file.startsWith(ROOT)) throw new Error("fuera de la raíz");
      res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
      res.end(await readFile(file));
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve) => server.listen(0, () => resolve({ server, base: `http://localhost:${server.address().port}/` })));
}

export const launch = () => chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ["--no-sandbox", "--host-resolver-rules=MAP tienda.test 127.0.0.1"] });

/** "Ahora" de los tests: martes 10 de nov de 2026, 10:00 en Buenos Aires. Así no dependen de la hora en que se corran. */
export const NOW = new Date("2026-11-10T13:00:00Z");

/** Sábado 14 de nov, 10:00: sin trabajo, así que hay tareas a la vista en "Ahora". */
export const SAT = new Date("2026-11-14T13:00:00Z");

/** Tarea hecha hace `daysAgo` días (para armar rachas). */
export const doneTask = (daysAgo, i = 0, extra = {}) => ({ id: `d${daysAgo}-${i}`, title: "Algo hecho", minutes: 60, effort: "hard", status: "done", doneAt: new Date(NOW.getTime() - daysAgo * 86400000 - i * 3600000).toISOString(), repeat: null, subtasks: [], ...extra });

/**
 * Abre la app lista para usar.
 * @param {import("playwright").Browser} browser
 * @param {string} base
 * @param {{profile?: object|null, tasks?: object[], voice?: boolean, capacitor?: boolean, width?: number, height?: number, sw?: boolean, colorScheme?: string, reducedMotion?: boolean, time?: Date, raw?: Record<string,string>}} o
 */
export async function openApp(browser, base, { profile = exampleProfile, tasks = [], voice = false, capacitor = false, width = 384, height = 832, sw = false, colorScheme = "light", reducedMotion = false, time = NOW, raw = null } = {}) {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], viewport: { width, height }, locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires", serviceWorkers: sw ? "allow" : "block", colorScheme, reducedMotion: reducedMotion ? "reduce" : "no-preference", acceptDownloads: true });
  if (time) await ctx.clock.install({ time });
  await ctx.addInitScript(
    ([p, t, r]) => {
      if (localStorage.getItem("mytempo.seeded")) return;
      localStorage.setItem("mytempo.seeded", "1");
      if (r) for (const [k, v] of Object.entries(r)) localStorage.setItem(k, v);
      else if (p) {
        localStorage.setItem("mytempo.profile", JSON.stringify(p));
        localStorage.setItem("mytempo.tasks", JSON.stringify(t));
        localStorage.setItem("mytempo.checkins", "[]");
      }
    },
    [profile, tasks, raw]
  );
  if (voice) {
    await ctx.addInitScript(() => {
      window.SpeechRecognition = window.webkitSpeechRecognition = class {
        start() {
          this.onstart();
          setTimeout(() => {
            this.onresult({ results: [Object.assign([{ transcript: "llamar al dentista mañana" }], { isFinal: true })] });
            this.onend();
          }, 50);
        }
        stop() {
          this.onend();
        }
      };
    });
  }
  if (capacitor) {
    // Un "Capacitor" de mentira: guarda lo que la app le pide programar, para verificar que lo hace bien.
    await ctx.addInitScript(() => {
      // El WebView de Android no trae la API Notification del navegador: la app no puede depender de ella.
      delete window.Notification;
      window.__native = { scheduled: [], cancelled: [], permission: "granted" };
      window.Capacitor = {
        Plugins: {
          App: { addListener: (name, fn) => (window.__native.listeners = { ...(window.__native.listeners ?? {}), [name]: fn }), exitApp: () => (window.__native.exited = true) },
          LocalNotifications: {
            requestPermissions: async () => ({ display: window.__native.permission }),
            getPending: async () => ({ notifications: window.__native.scheduled.map((n) => ({ id: n.id })) }),
            cancel: async ({ notifications }) => {
              window.__native.cancelled.push(...notifications.map((n) => n.id));
              window.__native.scheduled = window.__native.scheduled.filter((n) => !notifications.some((c) => c.id === n.id));
            },
            schedule: async ({ notifications }) => void window.__native.scheduled.push(...notifications),
          },
        },
      };
    });
  }
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errors.push(m.text()));
  await page.goto(base);
  return { ctx, page, errors };
}

export const tab = (page, name) => page.getByRole("button", { name, exact: true }).click();
export const stored = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), key);
export const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** Espera a que termine el onboarding: la barra de "Sumar" existe siempre, lo que cambia es que desaparece el overlay. */
export async function ready(page) {
  await page.waitForSelector(".onb", { state: "detached" });
  await page.waitForSelector(".composer");
}
