// Flujo completo en un navegador real, con el tamaño de un celular. Usa el perfil de ejemplo (genérico).
// Correr: npm run e2e   (la primera vez: npx playwright install chromium)

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { startServer, launch, openApp, tab, overflow, doneTask } from "./helpers.js";

let server, browser, base;
before(async () => {
  ({ server, base } = await startServer());
  browser = await launch();
});
after(async () => {
  await browser?.close();
  server?.close();
});
const open = (o) => openApp(browser, base, o).then(async (r) => (await r.page.waitForSelector(".composer"), r));

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
