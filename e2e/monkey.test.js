// "Mono": toca cosas al azar (con semilla, repetible) y verifica que la app nunca se rompa:
// sin errores de JavaScript, sin desbordes y con algo en pantalla siempre.
import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./setup.js";
import { exampleProfile, doneTask, overflow, SAT } from "./helpers.js";
import { rng } from "../test/helpers.js";

const env = setup();
const WORDS = ["Estudiar 30m", "😀", "<b>x</b>", "Lavar ropa cada semana #liviana", "a".repeat(150), "", "  ", "Reunión mañana 14:00 60m"];

async function monkey(page, errors, seed, steps) {
  const r = rng(seed);
  for (let i = 0; i < steps; i++) {
    const sel = "button:visible, input:visible, select:visible";
    const els = page.locator(sel);
    const n = await els.count();
    if (!n) break;
    const el = els.nth(r.int(0, n - 1));
    const label = ((await el.textContent().catch(() => "")) || (await el.getAttribute("aria-label").catch(() => "")) || "").trim();
    if (/Borrar todo|Sí, borrar|Importar/.test(label)) continue; // esas se prueban aparte
    const tag = await el.evaluate((e) => e.tagName.toLowerCase()).catch(() => "");
    try {
      if (tag === "input") {
        const type = await el.getAttribute("type");
        if (type === "file") continue;
        await el.fill(r.pick(WORDS), { timeout: 1000 });
        if (r.chance(0.5)) await page.keyboard.press("Enter");
      } else if (tag === "select") {
        const opts = await el.locator("option").evaluateAll((o) => o.map((x) => x.value));
        if (opts.length) await el.selectOption(r.pick(opts), { timeout: 1000 });
      } else {
        await el.click({ timeout: 1000 });
      }
    } catch {
      /* el elemento desapareció a mitad de camino: normal en una UI que se redibuja */
    }
    if (r.chance(0.1)) await page.keyboard.press("Escape");
    assert.deepEqual(errors, [], `error de JS en el paso ${i} (semilla ${seed})`);
    if (i % 10 === 0) assert.equal(await overflow(page), 0, `desborde en el paso ${i} (semilla ${seed})`);
  }
  const text = await page.locator("#app").innerText();
  assert.ok(text.trim().length > 10, `pantalla en blanco (semilla ${seed})`);
}

for (const seed of [1, 2, 3]) {
  test(`mono con la semilla ${seed}: 80 toques al azar sin romper nada`, async () => {
    const { ctx, page, errors } = await env.open({ profile: exampleProfile, time: SAT, tasks: [doneTask(1), doneTask(2), { id: "p", title: "Pendiente", minutes: 90, effort: "hard", status: "todo", subtasks: [], repeat: "week", priority: 2 }] });
    await monkey(page, errors, seed, 80);
    // y la app sigue guardando datos válidos
    const profile = await page.evaluate(() => JSON.parse(localStorage.getItem("mytempo.profile")));
    assert.ok(profile?.wake);
    await ctx.close();
  });
}

test("mono en pantalla chica (320 px), modo oscuro", async () => {
  const { ctx, page, errors } = await env.open({ profile: exampleProfile, width: 320, height: 568, colorScheme: "dark", time: SAT, tasks: [doneTask(1)] });
  await monkey(page, errors, 99, 80);
  await ctx.close();
});
