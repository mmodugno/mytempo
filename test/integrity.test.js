// Integridad del paquete: que lo que se publica (y lo que irá dentro de la app de Android) esté completo y sea coherente.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname, resolve, relative } from "node:path";
import { validateProfile } from "../src/store/profile.js";
import { plan } from "../src/engine/planner.js";
import { effectiveProfile } from "../src/engine/learn.js";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const walk = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));

const srcFiles = walk("src").filter((f) => f.endsWith(".js"));
const swFiles = new Function(`return ${read("sw.js").match(/const FILES = (\[[\s\S]*?\]);/)[1]}`)();

test("el service worker precachea TODOS los módulos (si falta uno, la app falla sin conexión)", () => {
  const missing = srcFiles.filter((f) => !swFiles.includes(f));
  assert.deepEqual(missing, [], `faltan en sw.js: ${missing.join(", ")}`);
});

test("todo lo que lista el service worker existe", () => {
  const ghosts = swFiles.filter((f) => f !== "." && !existsSync(join(ROOT, f)));
  assert.deepEqual(ghosts, []);
  assert.equal(new Set(swFiles).size, swFiles.length, "hay archivos repetidos en la lista");
});

test("la versión del caché es 'mytempo-vN'", () => {
  assert.match(read("sw.js"), /const CACHE = "mytempo-v\d+"/);
});

test("todos los import relativos apuntan a un archivo que existe", () => {
  for (const f of srcFiles) {
    for (const m of read(f).matchAll(/(?:import|export)[^'"]*?from\s*["'](\.[^"']+)["']|import\(\s*["'](\.[^"']+)["']\s*\)/g)) {
      const target = m[1] ?? m[2];
      const abs = resolve(ROOT, dirname(f), target);
      assert.ok(existsSync(abs) && statSync(abs).isFile(), `${f} importa ${target} y no existe`);
    }
  }
});

test("el motor no depende del navegador (se puede usar en cualquier lado)", () => {
  for (const f of srcFiles.filter((x) => x.startsWith("src/engine/"))) {
    const code = read(f);
    assert.ok(!/\b(document|window|localStorage|navigator)\b/.test(code.replace(/\/\/.*$/gm, "")), `${f} toca el navegador`);
    assert.ok(!/from\s*["']\.\.\/ui\//.test(code), `${f} importa de la UI`);
  }
});

test("index.html: idioma, viewport, manifest e ícono", () => {
  const html = read("index.html");
  assert.match(html, /<html[^>]*lang="es"/);
  assert.match(html, /name="viewport"[^>]*width=device-width/);
  assert.match(html, /rel="manifest"/);
  assert.match(html, /<title>[^<]+<\/title>/);
  assert.match(html, /theme-color/);
  for (const m of html.matchAll(/(?:src|href)="(?!https?:|#|data:)([^"]+)"/g)) assert.ok(existsSync(join(ROOT, m[1])), `index.html referencia ${m[1]}`);
});

test("manifest: instalable (nombre, inicio, íconos que existen)", () => {
  const mf = JSON.parse(read("manifest.webmanifest"));
  assert.ok(mf.name && mf.short_name && mf.start_url && mf.display === "standalone");
  const sizes = mf.icons.map((i) => i.sizes);
  assert.ok(sizes.includes("192x192") && sizes.includes("512x512"), "faltan íconos 192 y 512");
  for (const i of mf.icons) assert.ok(existsSync(join(ROOT, i.src)), `falta ${i.src}`);
});

test("los íconos PNG son PNG de verdad y del tamaño que dicen", () => {
  for (const [file, size] of [["icons/icon-192.png", 192], ["icons/icon-512.png", 512]]) {
    const b = readFileSync(join(ROOT, file));
    assert.equal(b.subarray(1, 4).toString(), "PNG");
    assert.equal(b.readUInt32BE(16), size);
    assert.equal(b.readUInt32BE(20), size);
  }
});

test("el perfil de ejemplo es válido, genérico y arma un plan", () => {
  const p = JSON.parse(read("data/perfil-ejemplo.json"));
  assert.deepEqual(validateProfile(p), []);
  const r = plan(effectiveProfile(p, [], new Date(2026, 10, 9, 9)), [{ id: "a", title: "Algo", status: "todo", minutes: 30 }], new Date(2026, 10, 9, 9));
  assert.equal(r.unplaced.length, 0);
  assert.ok(!/magali|modugno/i.test(JSON.stringify(p)), "el ejemplo no puede tener datos personales");
});

test("privacidad: ningún archivo del repo trae datos personales ni claves", () => {
  const files = [...walk("src"), ...walk("data"), ...walk("docs").filter((f) => /\.(md|json)$/.test(f)), "README.md", "index.html", "sw.js", "capacitor.config.json", "package.json"];
  for (const f of files) {
    const t = read(f);
    assert.ok(!/magalimodugno@|perfil-magali/i.test(t.replace(/mmodugno\/mytempo|mmodugno\.github\.io|github\.com\/mmodugno/g, "")), `${f}: dato personal`);
    assert.ok(!/(api[_-]?key|secret|password|BEGIN (RSA|PRIVATE))/i.test(t), `${f}: parece traer una clave`);
  }
  const gi = read(".gitignore");
  for (const entry of ["node_modules", "*.keystore", "*.jks", "android/", "www/"]) assert.ok(gi.includes(entry), `.gitignore sin ${entry}`);
});

test("sin dependencias externas en tiempo de ejecución (todo funciona offline)", () => {
  const pkg = JSON.parse(read("package.json"));
  assert.equal(pkg.dependencies, undefined);
  for (const f of ["index.html", ...srcFiles, "styles.css"]) assert.ok(!/https?:\/\/(?!github\.com|mmodugno|www\.w3\.org)/.test(read(f).replace(/\/\/.*$/gm, "")), `${f} carga algo de internet`);
});

test("capacitor.config.json es coherente con el proyecto", () => {
  const c = JSON.parse(read("capacitor.config.json"));
  assert.match(c.appId, /^[a-z]+(\.[a-z0-9]+)+$/);
  assert.equal(c.webDir, "www");
  assert.ok(read("scripts/build-www.sh").includes("www"));
  assert.ok(relative(ROOT, join(ROOT, "docs/google-play.md")) && existsSync(join(ROOT, "docs/google-play.md")));
});

test("la licencia y el README existen", () => {
  assert.match(read("LICENSE"), /MIT/);
  assert.ok(read("README.md").length > 500);
});
