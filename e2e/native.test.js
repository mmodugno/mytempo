// La app dentro de Android (Capacitor): los avisos se programan en el sistema y llegan con la app cerrada.
// Acá se simula el plugin: se verifica QUÉ le pide la app, no el sonido del teléfono.
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./setup.js";
import { bareProfile, SAT, tab } from "./helpers.js";

const env = setup();
const todo = (id, title, extra = {}) => ({ id, title, minutes: 30, effort: "medium", status: "todo", repeat: null, subtasks: [], priority: 2, ...extra });
const native = (page) => page.evaluate(() => window.__native);

test("activar recordatorios pide permiso y programa avisos futuros en el sistema", async () => {
  const { ctx, page, errors } = await env.open({ profile: bareProfile, time: SAT, capacitor: true, tasks: [todo("a", "Estudiar"), todo("b", "Ordenar", { effort: "light" })] });
  await tab(page, "Ajustes");
  await page.getByText("Avisarme antes de cada tarea").click();
  await page.waitForFunction(() => window.__native.scheduled.length > 0);
  const { scheduled } = await native(page);
  assert.ok(scheduled.length >= 2);
  for (const n of scheduled) {
    assert.ok(Number.isInteger(n.id) && n.id > 0, "id entero");
    assert.ok(n.title && n.body, "con texto");
    assert.ok(new Date(n.schedule.at) > SAT, "en el futuro");
    assert.equal(n.schedule.allowWhileIdle, true);
  }
  assert.equal(new Set(scheduled.map((n) => n.id)).size, scheduled.length, "ids únicos");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("si se niega el permiso no se programa nada", async () => {
  const { ctx, page } = await env.open({ profile: bareProfile, time: SAT, capacitor: true, tasks: [todo("a", "Estudiar")] });
  await page.evaluate(() => (window.__native.permission = "denied"));
  await tab(page, "Ajustes");
  await page.getByText("Avisarme antes de cada tarea").click();
  await page.waitForTimeout(400);
  assert.equal((await native(page)).scheduled.length, 0);
  await ctx.close();
});

test("al desactivar los recordatorios se cancelan los pendientes", async () => {
  const { ctx, page } = await env.open({ profile: bareProfile, time: SAT, capacitor: true, tasks: [todo("a", "Estudiar")] });
  await tab(page, "Ajustes");
  await page.getByText("Avisarme antes de cada tarea").click();
  await page.waitForFunction(() => window.__native.scheduled.length > 0);
  await page.getByText("Avisarme antes de cada tarea").click();
  await page.waitForFunction(() => window.__native.scheduled.length === 0);
  assert.ok((await native(page)).cancelled.length > 0);
  await ctx.close();
});

test("al cambiar el plan (nueva tarea) se reprograman los avisos sin duplicar", async () => {
  const { ctx, page } = await env.open({ profile: bareProfile, time: SAT, capacitor: true, tasks: [todo("a", "Estudiar")] });
  await tab(page, "Ajustes");
  await page.getByText("Avisarme antes de cada tarea").click();
  await page.waitForFunction(() => window.__native.scheduled.length > 0);
  const before = (await native(page)).scheduled.length;
  await page.locator(".composer input").fill("Otra cosa 20m");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  const after = (await native(page)).scheduled;
  assert.ok(after.length >= before);
  assert.equal(new Set(after.map((n) => n.id)).size, after.length, "no hay avisos repetidos");
  await ctx.close();
});

test("el botón 'atrás' de Android: cierra la hoja, vuelve a Ahora y recién después sale", async () => {
  const { ctx, page } = await env.open({ profile: bareProfile, time: SAT, capacitor: true });
  const back = () => page.evaluate(() => window.__native.listeners.backButton());
  await tab(page, "Resumen");
  await page.getByRole("button", { name: "Más opciones de la tarea" }).click();
  await page.waitForSelector(".sheet");
  await back();
  await page.waitForSelector(".sheet", { state: "detached" });
  assert.equal((await native(page)).exited, undefined, "con una hoja abierta no sale de la app");
  await back();
  assert.equal(await page.getByRole("button", { name: "Ahora", exact: true }).getAttribute("aria-current"), "page");
  assert.equal((await native(page)).exited, undefined);
  await back();
  assert.equal((await native(page)).exited, true);
  await ctx.close();
});
