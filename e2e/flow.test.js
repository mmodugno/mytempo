// Flujo completo en un navegador real, con el tamaño de un celular. Usa el perfil de ejemplo (genérico).
// Correr: npm run e2e   (la primera vez: npx playwright install chromium)

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { chromium, devices } from "playwright";

const ROOT = new URL("..", import.meta.url).pathname;
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png", ".svg": "image/svg+xml" };

let server, browser, base;
const profile = JSON.parse(await readFile(join(ROOT, "data/perfil-ejemplo.json"), "utf8"));

before(async () => {
  server = createServer(async (req, res) => {
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
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}/`;
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, args: ["--no-sandbox"] });
});

after(async () => {
  await browser?.close();
  server?.close();
});

async function open({ voice = false } = {}) {
  const ctx = await browser.newContext({ ...devices["Pixel 7"], viewport: { width: 384, height: 832 }, locale: "es-AR", timezoneId: "America/Argentina/Buenos_Aires", serviceWorkers: "block" });
  await ctx.addInitScript((p) => {
    if (!localStorage.getItem("mytempo.profile")) {
      localStorage.setItem("mytempo.profile", JSON.stringify(p));
      localStorage.setItem("mytempo.tasks", "[]");
      localStorage.setItem("mytempo.checkins", "[]");
    }
  }, profile);
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
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForSelector(".composer");
  return { ctx, page, errors };
}

const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test("la rutina diaria aparece sola, sin cargar nada", async () => {
  const { ctx, page, errors } = await open();
  await page.waitForSelector(".hero");
  const routine = await page.evaluate(() => JSON.parse(localStorage.getItem("mytempo.tasks")).filter((t) => t.routineId).length);
  assert.ok(routine >= 1, "debería haber tareas de rutina");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("sumar una tarea, completarla y ver la reacción de la mascota", async () => {
  const { ctx, page, errors } = await open();
  await page.locator(".composer input").fill("leer 20 minutos");
  await page.getByRole("button", { name: "Sumar", exact: true }).click();
  await page.getByRole("button", { name: "Tareas", exact: true }).click();
  await page.getByText("leer", { exact: false }).first().waitFor();

  await page.getByRole("button", { name: "Ahora", exact: true }).click();
  await page.getByRole("button", { name: /^(Hecha|Ya la hice)$/ }).first().click();
  const bubble = page.locator(".pet-bubble");
  await bubble.waitFor();
  assert.match(await bubble.innerText(), /\+\d+ puntos/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("el vestidor: sin monedas no se compra; con puntos sí", async () => {
  const { ctx, page, errors } = await open();
  await page.getByRole("button", { name: "Resumen", exact: true }).click();
  await page.getByRole("button", { name: /^Gafas de sol/ }).click();
  assert.match(await page.locator(".closet").innerText(), /Te faltan \d+ monedas/);

  // Le damos una racha de 5 días con tareas difíciles y ahí sí alcanza
  await page.evaluate(() => {
    const tasks = [];
    for (let d = 0; d < 5; d++) for (let k = 0; k < 2; k++) tasks.push({ id: `e${d}${k}`, title: "Algo", minutes: 60, effort: "hard", status: "done", doneAt: new Date(Date.now() - d * 86400000 - k * 3600000).toISOString(), repeat: null, subtasks: [] });
    localStorage.setItem("mytempo.tasks", JSON.stringify(tasks));
  });
  await page.reload();
  await page.getByRole("button", { name: "Resumen", exact: true }).click();
  await page.getByRole("button", { name: /^Gafas de sol/ }).click();
  await page.getByRole("button", { name: /Gafas de sol/ }).and(page.locator("[aria-pressed=true]")).waitFor();
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("dictar por voz llena el campo", async () => {
  const { ctx, page } = await open({ voice: true });
  await page.getByRole("button", { name: "Dictar tarea por voz" }).click();
  await page.waitForFunction(() => document.querySelector(".composer input").value.includes("dentista"));
  await ctx.close();
});

test("ninguna pantalla se desborda en 384 ni en 320 px", async () => {
  const { ctx, page } = await open();
  for (const width of [384, 320]) {
    await page.setViewportSize({ width, height: 700 });
    for (const tab of ["Ahora", "Tareas", "Semana", "Resumen", "Ajustes"]) {
      await page.getByRole("button", { name: tab, exact: true }).click();
      assert.equal(await overflow(page), 0, `${tab} se desborda a ${width}px`);
    }
  }
  await ctx.close();
});
