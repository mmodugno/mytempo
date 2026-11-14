// Arranque común de los tests de flujo: servidor y navegador compartidos dentro de cada archivo.
import { before, after } from "node:test";
import { startServer, launch, openApp } from "./helpers.js";

export function setup() {
  const env = {};
  before(async () => {
    const s = await startServer();
    env.server = s.server;
    env.base = s.base;
    env.browser = await launch();
  });
  after(async () => {
    await env.browser?.close();
    env.server?.close();
  });
  env.open = async (o) => {
    const r = await openApp(env.browser, env.base, o);
    if (o?.profile !== null && !o?.raw) await r.page.waitForSelector(".composer");
    return r;
  };
  return env;
}
