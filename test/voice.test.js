import { test } from "node:test";
import assert from "node:assert/strict";
import { speechSupported, createVoice } from "../src/ui/voice.js";

function fakeWin() {
  const w = {};
  w.webkitSpeechRecognition = class {
    constructor() { w.last = this; }
    start() { this.onstart(); }
    stop() { this.onend(); }
  };
  return w;
}

test("detecta si el navegador soporta dictado", () => {
  assert.equal(speechSupported({}), false);
  assert.equal(speechSupported(fakeWin()), true);
});

test("el dictado llena el texto y se puede cortar", () => {
  const win = fakeWin();
  const log = [];
  const v = createVoice({ win, onText: (t, f) => log.push(["t", t, f]), onState: (s) => log.push(["s", s]), onError: (m) => log.push(["e", m]) });
  v.toggle();
  assert.equal(win.last.lang, "es-AR");
  win.last.onresult({ results: [Object.assign([{ transcript: "lavar los platos " }], { isFinal: false }), Object.assign([{ transcript: "mañana" }], { isFinal: true })] });
  win.last.onerror({ error: "not-allowed" });
  v.toggle();
  assert.deepEqual(log, [["s", true], ["t", "lavar los platos mañana", true], ["e", "Hace falta permiso para usar el micrófono."], ["s", false]]);
});
