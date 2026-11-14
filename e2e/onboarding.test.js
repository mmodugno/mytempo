import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./setup.js";
import { stored, tab } from "./helpers.js";

const env = setup();

test("primer uso: el onboarding arma el perfil y deja la app lista", async () => {
  const { ctx, page, errors } = await env.open({ profile: null });
  await page.waitForSelector(".onb");
  await page.getByPlaceholder("Tu nombre (opcional)").fill("Vale");
  await page.getByRole("button", { name: "Empezar" }).click();
  // pasos intermedios: avanzar con lo que venga por defecto
  for (let i = 0; i < 4; i++) {
    const seguir = page.getByRole("button", { name: /^(Siguiente|Seguir sin horarios)$/ });
    await seguir.click();
  }
  await page.getByRole("button", { name: "Armar mi semana" }).click();
  await page.waitForSelector(".composer");
  const profile = await stored(page, "mytempo.profile");
  assert.equal(profile.name, "Vale");
  assert.ok(profile.wake && profile.sleep);
  assert.equal(profile.energy.weekday.length, 24);
  assert.deepEqual(errors, []);
  await ctx.close();
});

test("el onboarding permite volver atrás sin perder lo escrito", async () => {
  const { ctx, page } = await env.open({ profile: null });
  await page.waitForSelector(".onb");
  await page.getByPlaceholder("Tu nombre (opcional)").fill("Sol");
  await page.getByRole("button", { name: "Empezar" }).click();
  await page.getByRole("button", { name: "Atrás" }).click();
  assert.equal(await page.getByPlaceholder("Tu nombre (opcional)").inputValue(), "Sol");
  await ctx.close();
});

test("'Probar con un perfil de ejemplo' salta directo a la app", async () => {
  const { ctx, page } = await env.open({ profile: null });
  await page.waitForSelector(".onb");
  await page.getByRole("button", { name: "Probar con un perfil de ejemplo" }).click();
  await page.waitForSelector(".composer");
  assert.equal((await stored(page, "mytempo.profile")).name, "Ejemplo");
  await ctx.close();
});

test("el onboarding no se desborda en pantallas chicas", async () => {
  const { ctx, page } = await env.open({ profile: null, width: 320, height: 568 });
  await page.waitForSelector(".onb");
  for (let i = 0; i < 3; i++) {
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), 0);
    await page.getByRole("button", { name: /^(Empezar|Siguiente|Seguir sin horarios)$/ }).click();
  }
  await ctx.close();
});
