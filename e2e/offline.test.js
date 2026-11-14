import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./setup.js";
import { bareProfile, stored, tab } from "./helpers.js";

const env = setup();

test("con el service worker instalado la app abre y funciona SIN conexión", async () => {
  const { ctx, page, errors } = await env.open({ profile: bareProfile, sw: true });
  await page.evaluate(() => navigator.serviceWorker.ready);
  // el precaché termina de llenarse
  await page.waitForFunction(async () => (await caches.keys()).length > 0 && (await (await caches.open((await caches.keys())[0])).keys()).length > 30);
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector(".composer");
  await page.locator(".composer input").fill("Anotar sin internet 5m");
  await page.keyboard.press("Enter");
  for (const name of ["Tareas", "Semana", "Resumen", "Ajustes"]) await tab(page, name);
  assert.ok((await stored(page, "mytempo.tasks")).some((t) => /sin internet/i.test(t.title)));
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("el precaché trae todos los módulos de la app", async () => {
  const { ctx, page } = await env.open({ profile: bareProfile, sw: true });
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForFunction(async () => (await caches.keys()).length > 0 && (await (await caches.open((await caches.keys())[0])).keys()).length > 30);
  const cached = await page.evaluate(async () => (await (await caches.open((await caches.keys())[0])).keys()).map((r) => new URL(r.url).pathname));
  for (const f of ["/src/ui/app.js", "/src/engine/planner.js", "/src/engine/pet.js", "/src/ui/voice.js", "/styles.css", "/manifest.webmanifest", "/icons/icon-192.png"]) assert.ok(cached.includes(f), `falta ${f} en el caché`);
  await ctx.close();
});

test("el manifest es instalable y el service worker responde", async () => {
  const { ctx, page } = await env.open({ profile: bareProfile, sw: true });
  const mf = await page.evaluate(async () => (await fetch(document.querySelector("link[rel=manifest]").href)).json());
  assert.equal(mf.display, "standalone");
  assert.ok(await page.evaluate(() => navigator.serviceWorker.ready.then((r) => Boolean(r.active))));
  await ctx.close();
});
