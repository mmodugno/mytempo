import test from "node:test";
import assert from "node:assert/strict";
import { writeFile, readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setup } from "./setup.js";
import { stored, tab, bareProfile, openApp } from "./helpers.js";

const env = setup();
const metrics = (page) => stored(page, "mytempo.metrics");
const lockedCape = (page) => page.getByRole("button", { name: /Capa · Plus/ });

test("tocar un accesorio con candadito abre Plus y suma un contador local", async () => {
  const { ctx, page, errors } = await env.open({ profile: bareProfile });
  const requests = [];
  page.on("request", (r) => !r.url().startsWith(env.base) && requests.push(r.url()));
  await tab(page, "Resumen");
  await lockedCape(page).click();
  await page.getByRole("heading", { name: "mytempo Plus" }).waitFor();
  const m = await metrics(page);
  assert.equal(m.counts["plus_lock_tap:cape"], 1);
  assert.equal(m.counts.plus_open, 1);
  assert.equal(m.consent, false, "el permiso arranca apagado");
  assert.deepEqual(requests, [], "sin permiso no sale nada a internet");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("'Me interesa' se cuenta y agradece, sin cobrar nada", async () => {
  const { ctx, page } = await env.open({ profile: bareProfile });
  await tab(page, "Ajustes");
  await page.getByRole("button", { name: "Ver qué incluye Plus" }).click();
  assert.match(await page.locator(".sheet").innerText(), /Próximamente en Google Play/);
  await page.getByRole("button", { name: "Me interesa" }).click();
  assert.equal((await metrics(page)).counts.plus_interest, 1);
  await page.locator(".toast").waitFor();
  await ctx.close();
});

test("con el permiso apagado no se envía nada, aunque haya dirección; con el permiso prendido se envía solo el evento", async () => {
  const { ctx, page } = await env.open({ profile: bareProfile, raw: null });
  const sent = [];
  await ctx.route("**/__metrics", async (route) => {
    sent.push(route.request().postData());
    await route.fulfill({ status: 204 });
  });
  await page.evaluate((u) => localStorage.setItem("mytempo.metricsUrl", u), `${env.base}__metrics`);
  await tab(page, "Resumen");
  await lockedCape(page).click();
  await page.waitForTimeout(300);
  assert.deepEqual(sent, [], "permiso apagado: nada");
  await page.keyboard.press("Escape");

  await tab(page, "Ajustes");
  await page.getByRole("switch", { name: /Compartir uso anónimo/ }).click();
  assert.equal((await metrics(page)).consent, true);
  await tab(page, "Resumen");
  await lockedCape(page).click();
  await page.waitForFunction(() => true);
  await page.waitForTimeout(400);
  assert.equal(sent.length >= 2, true, "plus_lock_tap y plus_open");
  for (const body of sent) {
    const p = JSON.parse(body);
    assert.ok(["plus_lock_tap", "plus_open"].includes(p.event));
    assert.deepEqual(Object.keys(p).filter((k) => !["event", "feature", "from", "day", "v"].includes(k)), [], "no hay campos de más");
    assert.match(p.day, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(!/Ejemplo|Pomp|tarea|nombre/i.test(body), "sin datos de la persona");
  }
  await ctx.close();
});

test("el modo prueba desbloquea los accesorios Plus y se mantiene al recargar", async () => {
  const { ctx, page, errors } = await env.open({ profile: bareProfile });
  await tab(page, "Ajustes");
  await page.getByRole("button", { name: "Ver qué incluye Plus" }).click();
  await page.getByRole("switch", { name: /Modo prueba/ }).click();
  await page.getByRole("button", { name: "Ver mi Plus" }).waitFor();
  await tab(page, "Resumen");
  assert.equal(await lockedCape(page).count(), 0, "ya no está con candado");
  await page.getByRole("button", { name: /^Capa/ }).click();
  assert.equal(await page.getByRole("button", { name: /^✓ Capa/ }).count(), 1);
  await page.reload();
  await page.waitForSelector(".composer");
  await tab(page, "Resumen");
  assert.equal(await page.getByRole("button", { name: /^✓ Capa/ }).count(), 1, "sigue puesta tras recargar");
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("el modo prueba NO existe fuera de localhost (así no queda un Plus gratis en la tienda)", async () => {
  const { ctx, page } = await openApp(env.browser, env.base.replace("localhost", "tienda.test"), { profile: bareProfile });
  await page.waitForSelector(".composer");
  await tab(page, "Ajustes");
  await page.getByRole("button", { name: "Ver qué incluye Plus" }).click();
  assert.equal(await page.getByRole("switch", { name: /Modo prueba/ }).count(), 0);
  assert.equal(await page.evaluate(() => location.hostname), "tienda.test");
  await ctx.close();
});

test("Plus no viaja en los respaldos: ni se exporta ni se puede 'regalar' importando", async () => {
  const dir = await mkdtemp(join(tmpdir(), "mytempo-"));
  const file = join(dir, "r.json");
  await writeFile(file, JSON.stringify({ app: "mytempo", version: 1, plus: { on: true }, profile: bareProfile, tasks: [], checkins: [] }));
  const { ctx, page } = await env.open({ profile: bareProfile });
  await tab(page, "Ajustes");
  await page.locator("input[type=file]").setInputFiles(file);
  await page.waitForTimeout(400);
  assert.equal(await stored(page, "mytempo.plus"), null, "importar no activa Plus");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Exportar respaldo" }).click()]);
  const out = join(dir, "salida.json");
  await download.saveAs(out);
  assert.ok(!/"plus"/.test(await readFile(out, "utf8")), "el respaldo no lleva Plus");
  await ctx.close();
});

test("el permiso de uso anónimo arranca apagado y se puede prender y apagar", async () => {
  const { ctx, page } = await env.open({ profile: bareProfile });
  await tab(page, "Ajustes");
  const sw = page.getByRole("switch", { name: /Compartir uso anónimo/ });
  assert.equal(await sw.getAttribute("aria-checked"), "false");
  await sw.click();
  assert.equal(await sw.getAttribute("aria-checked"), "true");
  await sw.click();
  assert.equal(await sw.getAttribute("aria-checked"), "false");
  assert.equal((await metrics(page)).consent, false);
  await ctx.close();
});

test("la hoja de Plus se ve bien en 320 px y en oscuro", async () => {
  const { ctx, page } = await env.open({ profile: bareProfile, width: 320, height: 568, colorScheme: "dark" });
  await tab(page, "Ajustes");
  await page.getByRole("button", { name: "Ver qué incluye Plus" }).click();
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.equal(o, 0);
  const sheet = await page.locator(".sheet").boundingBox();
  assert.ok(sheet.width <= 320);
  await ctx.close();
});

test("dentro de la app de Android el modo prueba no existe, ni siquiera en 'localhost' ni con ?plusdemo", async () => {
  const { ctx, page } = await openApp(env.browser, `${env.base}?plusdemo`, { profile: bareProfile, capacitor: true });
  await page.waitForSelector(".composer");
  await tab(page, "Ajustes");
  await page.getByRole("button", { name: "Ver qué incluye Plus" }).click();
  assert.equal(await page.getByRole("switch", { name: /Modo prueba/ }).count(), 0);
  assert.equal(await page.evaluate(() => location.hostname), "localhost");
  await ctx.close();
});
