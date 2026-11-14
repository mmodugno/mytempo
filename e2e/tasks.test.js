import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./setup.js";
import { stored, tab, doneTask, bareProfile, SAT } from "./helpers.js";

const env = setup();
const todo = (id, title, extra = {}) => ({ id, title, minutes: 30, effort: "medium", status: "todo", repeat: null, subtasks: [], priority: 2, ...extra });
const titles = async (page) => (await stored(page, "mytempo.tasks")).map((t) => `${t.title}:${t.status}`);

test("sumar varias tareas con la carga rápida entiende duración y esfuerzo", async () => {
  const { ctx, page, errors } = await env.open({ profile: bareProfile });
  await page.locator(".composer input").fill("Estudiar inglés 45m #exigente");
  await page.keyboard.press("Enter");
  await page.locator(".composer input").fill("Regar las plantas 10m");
  await page.keyboard.press("Enter");
  const tasks = await stored(page, "mytempo.tasks");
  const ingles = tasks.find((t) => /inglés/i.test(t.title));
  assert.equal(ingles.minutes, 45);
  assert.equal(ingles.effort, "hard");
  assert.equal(tasks.find((t) => /plantas/i.test(t.title)).minutes, 10);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("una entrada vacía o de puros espacios no crea tareas", async () => {
  const { ctx, page } = await env.open({ profile: bareProfile, tasks: [] });
  const before = (await stored(page, "mytempo.tasks")).length;
  await page.locator(".composer input").fill("    ");
  await page.getByRole("button", { name: "Sumar", exact: true }).click();
  assert.equal((await stored(page, "mytempo.tasks")).length, before);
  await ctx.close();
});

test("textos raros (HTML, emojis, larguísimos) se guardan como texto y no rompen nada", async () => {
  const { ctx, page, errors } = await env.open({ profile: bareProfile, tasks: [] });
  for (const text of ["<img src=x onerror=alert(1)> probar", "😀🐶 comprar pan", "a".repeat(300)]) {
    await page.locator(".composer input").fill(text);
    await page.keyboard.press("Enter");
  }
  await tab(page, "Tareas");
  assert.equal(await page.locator("img[src='x']").count(), 0, "el HTML no debe interpretarse");
  assert.equal(await page.evaluate(() => window.__xss === undefined), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("'No hoy' pasa la tarea para mañana sin perderla", async () => {
  const { ctx, page, errors } = await env.open({ profile: bareProfile, time: SAT, tasks: [todo("a", "Escribir informe", { effort: "hard" })] });
  await page.waitForSelector(".hero");
  await page.getByRole("button", { name: "No hoy" }).first().click();
  const t = (await stored(page, "mytempo.tasks")).find((x) => x.id === "a");
  assert.equal(t.status, "todo");
  assert.ok(t.notBefore, "debería quedar para después de hoy");
  assert.ok(new Date(t.notBefore) > new Date("2026-11-14T15:00:00Z"));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("completar una tarea repetida crea la próxima y no pierde la hecha", async () => {
  const { ctx, page } = await env.open({ profile: bareProfile, time: SAT, tasks: [todo("r", "Regar", { repeat: "day", minutes: 10, effort: "light" })] });
  await page.waitForSelector(".hero");
  await page.getByRole("button", { name: /^(Hecha|Ya la hice|Toda hecha)$/ }).first().click();
  await page.waitForTimeout(300);
  const t = (await stored(page, "mytempo.tasks")).filter((x) => x.title === "Regar");
  assert.equal(t.filter((x) => x.status === "done").length, 1);
  assert.equal(t.filter((x) => x.status === "todo").length, 1);
  await ctx.close();
});

test("terminar por bloques: suma puntos, la tarea sigue pendiente con menos tiempo", async () => {
  const { ctx, page, errors } = await env.open({ profile: bareProfile, time: SAT, tasks: [todo("g", "Armar presentación", { minutes: 120, effort: "hard" })] });
  await page.waitForSelector(".hero");
  await page.getByRole("button", { name: "Terminé este bloque" }).click();
  const t = (await stored(page, "mytempo.tasks")).find((x) => x.id === "g");
  assert.equal(t.status, "todo");
  assert.equal(t.partials.length, 1);
  assert.ok(t.doneMinutes > 0 && t.doneMinutes < 120);
  await tab(page, "Resumen");
  assert.match(await page.locator(".pet-sum").innerText(), /1\s*\n?\s*día seguido/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("mover a mano: la tarea queda fijada en el día y la hora elegidos, y se puede soltar", async () => {
  const { ctx, page, errors } = await env.open({ profile: bareProfile, time: SAT, tasks: [todo("m", "Llamar al banco", { minutes: 30 })] });
  await tab(page, "Semana");
  await page.getByText("Llamar al banco").first().click();
  await page.getByRole("heading", { name: "Mover tarea" }).waitFor();
  await page.getByRole("radio", { name: "Mañana" }).or(page.getByRole("button", { name: "Mañana", exact: true })).first().click();
  await page.getByLabel("Hora", { exact: true }).selectOption("15");
  await page.getByLabel("Minutos").selectOption("30");
  await page.getByRole("button", { name: "Mover acá" }).click();
  const pin = (await stored(page, "mytempo.tasks")).find((x) => x.id === "m").pin;
  assert.deepEqual(pin, { date: "2026-11-15", start: 15 * 60 + 30 });
  assert.match(await page.locator("main").innerText(), /15:30/);

  await page.getByText("Llamar al banco").first().click();
  await page.getByRole("button", { name: "Que la acomode la app" }).click();
  assert.equal((await stored(page, "mytempo.tasks")).find((x) => x.id === "m").pin ?? null, null);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("el plan nunca deja dos tareas encimadas en pantalla (Semana)", async () => {
  const many = Array.from({ length: 10 }, (_, i) => todo(`k${i}`, `Tarea ${i}`, { minutes: 30 + (i % 3) * 15 }));
  const { ctx, page } = await env.open({ profile: bareProfile, tasks: many });
  await tab(page, "Semana");
  const boxes = await page.locator(".row").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [r.top, r.bottom]));
  for (let i = 1; i < boxes.length; i++) assert.ok(boxes[i][0] >= boxes[i - 1][0] - 1, "las filas van en orden");
  await ctx.close();
});

test("la racha y los puntos se calculan al abrir y no se pierden al recargar", async () => {
  const tasks = [0, 1, 2, 3].map((d) => doneTask(d + 1));
  const { ctx, page } = await env.open({ profile: bareProfile, tasks });
  await page.waitForSelector(".pet");
  const text = () => page.locator(".pet").innerText();
  const first = await text();
  assert.match(first, /4\s*\n?\s*días seguidos/);
  await page.reload();
  await page.waitForSelector(".pet");
  assert.equal((await text()).match(/Nivel \d+ · \d+ puntos/)[0], first.match(/Nivel \d+ · \d+ puntos/)[0]);
  await ctx.close();
});
