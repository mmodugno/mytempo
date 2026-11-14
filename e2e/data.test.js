import test from "node:test";
import assert from "node:assert/strict";
import { writeFile, readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setup } from "./setup.js";
import { stored, tab, ready, bareProfile, doneTask, exampleProfile } from "./helpers.js";

const env = setup();

test("los datos sobreviven a recargar la página", async () => {
  const { ctx, page } = await env.open({ profile: bareProfile });
  await page.locator(".composer input").fill("Pagar la luz 10m");
  await page.keyboard.press("Enter");
  await page.reload();
  await page.waitForSelector(".composer");
  assert.ok((await stored(page, "mytempo.tasks")).some((t) => /luz/i.test(t.title)));
  await ctx.close();
});

test("exportar descarga un respaldo válido con todo adentro", async () => {
  const { ctx, page } = await env.open({ profile: bareProfile, tasks: [doneTask(1)] });
  await tab(page, "Ajustes");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exportar respaldo" }).click()]);
  assert.equal(download.suggestedFilename(), "mytempo-respaldo.json");
  const path = join(await mkdtemp(join(tmpdir(), "mytempo-")), "r.json");
  await download.saveAs(path);
  const data = JSON.parse(await readFile(path, "utf8"));
  assert.equal(data.app, "mytempo");
  assert.ok(data.profile.wake && Array.isArray(data.tasks) && Array.isArray(data.checkins));
  assert.equal(data.tasks.filter((t) => t.status === "done").length, 1);
  await ctx.close();
});

test("importar un respaldo restaura perfil y tareas en otro dispositivo", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mytempo-"));
  const file = join(dir, "respaldo.json");
  await writeFile(file, JSON.stringify({ app: "mytempo", version: 1, profile: { ...bareProfile, name: "Importada", petName: "Nube" }, tasks: [{ id: "i1", title: "Tarea importada", status: "todo", minutes: 20 }], checkins: [] }));
  const { ctx, page, errors } = await env.open({ profile: null });
  await page.waitForSelector(".onb");
  await page.getByRole("button", { name: "Probar con un perfil de ejemplo" }).click();
  await ready(page);
  await tab(page, "Ajustes");
  await page.locator("input[type=file]").setInputFiles(file);
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("mytempo.profile")).name === "Importada");
  assert.ok((await stored(page, "mytempo.tasks")).some((t) => t.title === "Tarea importada"));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("importar un archivo que no sirve avisa y no pisa nada", async () => {
  const file = join(await mkdtemp(join(tmpdir(), "mytempo-")), "malo.json");
  await writeFile(file, "esto no es json");
  const { ctx, page } = await env.open({ profile: { ...bareProfile, name: "Intacta" } });
  await tab(page, "Ajustes");
  await page.locator("input[type=file]").setInputFiles(file);
  await page.locator(".toast").waitFor();
  assert.equal((await stored(page, "mytempo.profile")).name, "Intacta");
  await ctx.close();
});

test("'Borrar todo' pide confirmación y vuelve al principio", async () => {
  const { ctx, page } = await env.open({ profile: bareProfile, tasks: [doneTask(1)] });
  await tab(page, "Ajustes");
  await page.getByRole("button", { name: "Borrar todo" }).click();
  await page.getByRole("button", { name: "Cancelar" }).click();
  assert.ok(await stored(page, "mytempo.profile"), "cancelar no borra");
  await page.getByRole("button", { name: "Borrar todo" }).click();
  await page.getByRole("button", { name: "Sí, borrar" }).click();
  await page.waitForSelector(".onb");
  assert.equal(await stored(page, "mytempo.tasks"), null);
  await ctx.close();
});

test("si lo guardado está corrupto la app arranca igual, sin pantalla en blanco", async () => {
  const { ctx, page, errors } = await env.open({ profile: null, raw: { "mytempo.profile": "{rota", "mytempo.tasks": "xx", "mytempo.checkins": "[1," } });
  await page.waitForSelector(".onb, .composer");
  assert.ok((await page.locator("#app").innerText()).length > 20);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("un perfil viejo (sin mascota ni rutina) funciona y se completa solo", async () => {
  const old = { ...exampleProfile };
  delete old.routine;
  delete old.pet;
  delete old.petName;
  delete old.streakRest;
  const { ctx, page, errors } = await env.open({ profile: old });
  await tab(page, "Resumen");
  await page.getByText("Vestidor").waitFor();
  await tab(page, "Ajustes");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("cambiar el nombre de la mascota se refleja en la app", async () => {
  const { ctx, page } = await env.open({ profile: bareProfile });
  await tab(page, "Ajustes");
  const name = page.getByLabel("Nombre de tu mascota");
  await name.fill("Nube");
  await name.dispatchEvent("change");
  await tab(page, "Ahora");
  assert.match(await page.locator(".pet").innerText(), /NUBE/i);
  assert.equal((await stored(page, "mytempo.profile")).petName, "Nube");
  await ctx.close();
});
