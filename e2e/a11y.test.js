import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./setup.js";
import { bareProfile, exampleProfile, doneTask, tab, overflow, SAT } from "./helpers.js";

const env = setup();
const TABS = ["Ahora", "Tareas", "Semana", "Resumen", "Ajustes"];

/** Controles sin nombre accesible (lo que un lector de pantalla no sabría decir). */
const unnamed = (page) =>
  page.evaluate(() => {
    const name = (el) => {
      if (el.getAttribute("aria-label")?.trim()) return true;
      if (el.getAttribute("aria-labelledby")) return true;
      if (el.title?.trim()) return true;
      if (el.labels?.length && [...el.labels].some((l) => l.textContent.trim())) return true;
      return Boolean(el.textContent?.trim());
    };
    return [...document.querySelectorAll("button, input:not([type=file]):not([type=hidden]), select, textarea, a[href], [role=switch], [role=radio]")]
      .filter((el) => el.offsetParent !== null || getComputedStyle(el).position === "fixed")
      .filter((el) => !name(el) && !(el.tagName === "INPUT" && el.type === "text" && el.placeholder))
      .map((el) => `${el.tagName.toLowerCase()}.${el.className}`);
  });

test("todos los controles de todas las pantallas tienen nombre", async () => {
  const { ctx, page } = await env.open({ profile: exampleProfile, tasks: [doneTask(1)] });
  for (const name of TABS) {
    await tab(page, name);
    assert.deepEqual(await unnamed(page), [], `controles sin nombre en ${name}`);
  }
  await ctx.close();
});

test("los controles de las hojas (editar tarea, rutina, compromiso) también tienen nombre", async () => {
  const { ctx, page } = await env.open({ profile: bareProfile, tasks: [{ id: "a", title: "Algo", minutes: 30, effort: "medium", status: "todo", subtasks: [], repeat: null, priority: 2 }] });
  await page.getByRole("button", { name: "Más opciones de la tarea" }).click();
  await page.waitForSelector(".sheet");
  assert.deepEqual(await unnamed(page), [], "hoja de nueva tarea");
  await page.keyboard.press("Escape");
  await tab(page, "Ajustes");
  assert.deepEqual(await unnamed(page), [], "ajustes");
  await ctx.close();
});

test("las solapas y la barra de 'Sumar' siempre se ven, en cualquier tamaño de pantalla", async () => {
  const sizes = [[320, 568], [360, 640], [384, 832], [412, 915], [393, 852], [768, 1024], [1280, 720], [640, 360]];
  for (const [width, height] of sizes) {
    const { ctx, page } = await env.open({ profile: exampleProfile, width, height, tasks: [doneTask(1)] });
    for (const name of TABS) {
      await tab(page, name);
      const r = await page.evaluate(() => {
        const t = document.querySelector(".tabs").getBoundingClientRect();
        const c = document.querySelector(".composer").getBoundingClientRect();
        return { tabsBottom: t.bottom, tabsTop: t.top, composerTop: c.top, vh: innerHeight };
      });
      assert.ok(r.tabsBottom <= r.vh + 0.5 && r.tabsTop >= 0, `solapas fuera de pantalla en ${width}x${height} (${name})`);
      assert.ok(r.composerTop >= 0 && r.composerTop < r.tabsTop, `la barra de sumar no está sobre las solapas (${width}x${height})`);
      assert.equal(await overflow(page), 0, `desborde en ${width}x${height} ${name}`);
    }
    await ctx.close();
  }
});

test("las solapas siguen visibles con mucho contenido (la lista larga no las empuja)", async () => {
  const many = Array.from({ length: 60 }, (_, i) => ({ id: `t${i}`, title: `Tarea número ${i} con un nombre bastante largo para forzar el ajuste de línea`, minutes: 30, effort: "medium", status: "todo", subtasks: [], repeat: null, priority: 2 }));
  const { ctx, page } = await env.open({ profile: bareProfile, tasks: many, height: 640 });
  for (const name of ["Tareas", "Semana"]) {
    await tab(page, name);
    const r = await page.evaluate(() => ({ b: document.querySelector(".tabs").getBoundingClientRect().bottom, vh: innerHeight, scroll: document.scrollingElement.scrollHeight }));
    assert.ok(r.b <= r.vh + 0.5, `${name}: solapas fuera de pantalla`);
    assert.ok(r.scroll <= r.vh + 1, `${name}: la página entera scrollea (debería scrollear solo el contenido)`);
  }
  await ctx.close();
});

test("zonas táctiles: los botones principales miden al menos 40 px", async () => {
  const { ctx, page } = await env.open({ profile: bareProfile, time: SAT, tasks: [{ id: "a", title: "Algo", minutes: 30, effort: "medium", status: "todo", subtasks: [], repeat: null, priority: 2 }] });
  for (const name of TABS) {
    await tab(page, name);
    const small = await page.evaluate(() =>
      [...document.querySelectorAll("button, select, input[type=text], [role=switch]")]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        // las 24 barras del editor de energía son angostas por diseño (24 columnas en una pantalla); se tocan y se arrastran
        .filter(({ el }) => !/energía \d de \d/.test(el.getAttribute("aria-label") ?? ""))
        .filter(({ r }) => r.width > 0 && (r.height < 40 || r.width < 36))
        .map(({ el, r }) => `${el.tagName.toLowerCase()}.${el.className} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 20)}" ${Math.round(r.width)}x${Math.round(r.height)}`)
    );
    assert.deepEqual(small, [], `botones chicos en ${name}`);
  }
  await ctx.close();
});

test("modo oscuro: sin desbordes y la barra del teléfono toma el color del tema", async () => {
  const { ctx, page, errors } = await env.open({ profile: exampleProfile, tasks: [doneTask(1)], colorScheme: "dark" });
  assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), "dark");
  assert.equal(await page.evaluate(() => document.querySelector("meta[name=theme-color]").content), "#11151b");
  for (const name of TABS) {
    await tab(page, name);
    assert.equal(await overflow(page), 0, name);
  }
  await tab(page, "Ajustes");
  await page.getByRole("radio", { name: "Claro" }).or(page.getByRole("button", { name: "Claro", exact: true })).first().click();
  assert.equal(await page.evaluate(() => document.querySelector("meta[name=theme-color]").content), "#f5f0e6");
  assert.deepEqual(errors, []);
  await ctx.close();
});

function luminance([r, g, b]) {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

for (const scheme of ["light", "dark"]) {
  test(`contraste de los textos principales (${scheme}): al menos 4.5:1 el texto normal y 3:1 el secundario`, async () => {
    const { ctx, page } = await env.open({ profile: exampleProfile, colorScheme: scheme, tasks: [doneTask(1)] });
    const pairs = await page.evaluate(() => {
      const rgb = (s) => s.match(/[\d.]+/g).slice(0, 3).map(Number);
      const bg = rgb(getComputedStyle(document.body).backgroundColor);
      const pick = (sel) => {
        const el = document.querySelector(sel);
        return el ? { sel, fg: rgb(getComputedStyle(el).color), bg } : null;
      };
      return ["main h1, main h2", ".tabs button:not([aria-current])", ".tabs button[aria-current]", ".eyebrow", ".muted"].map(pick).filter(Boolean);
    });
    const failures = pairs.map((p) => ({ sel: p.sel, ratio: ratio(p.fg, p.bg) })).filter((p) => p.ratio < (/muted|eyebrow|tabs button:not/.test(p.sel) ? 3 : 4.5));
    assert.deepEqual(failures, [], "contraste insuficiente");
    await ctx.close();
  });
}

test("se puede usar con teclado: Enter suma y Escape cierra las hojas", async () => {
  const { ctx, page } = await env.open({ profile: bareProfile });
  await page.locator(".composer input").focus();
  await page.keyboard.type("Con teclado 5m");
  await page.keyboard.press("Enter");
  assert.ok(await page.evaluate(() => JSON.parse(localStorage.getItem("mytempo.tasks")).some((t) => /teclado/i.test(t.title))));
  await page.getByRole("button", { name: "Más opciones de la tarea" }).click();
  await page.waitForSelector(".sheet");
  await page.keyboard.press("Escape");
  await page.waitForSelector(".sheet", { state: "detached", timeout: 3000 });
  await ctx.close();
});

test("con 'reducir movimiento' no hay animaciones corriendo", async () => {
  const { ctx, page } = await env.open({ profile: exampleProfile, reducedMotion: true, tasks: [doneTask(1)] });
  await tab(page, "Resumen");
  const running = await page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && a.effect?.getTiming().iterations === Infinity).length);
  assert.equal(running, 0);
  await ctx.close();
});
