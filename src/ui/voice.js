// Dictado por voz para la barra de "Sumar tarea". Usa el reconocimiento del navegador (Web Speech API):
// en Chrome/Android el audio lo procesa el servicio de voz del sistema, no esta app. Si el navegador no lo
// ofrece, no se muestra el botón. Lo dictado va al campo de texto para revisarlo antes de sumar.

export const speechSupported = (win = window) => Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);

/**
 * @param {{win?: Window, lang?: string, onText: (t: string, final: boolean) => void, onState: (listening: boolean) => void, onError: (msg: string) => void}} o
 * @returns {{toggle: () => void}}
 */
export function createVoice({ win = window, lang = "es-AR", onText, onState, onError }) {
  const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
  let rec = null;
  const stop = () => rec?.stop();
  const start = () => {
    rec = new SR();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.onstart = () => onState(true);
    rec.onend = () => ((rec = null), onState(false));
    rec.onresult = (e) => {
      let text = "";
      let final = false;
      for (const r of Array.from(e.results)) {
        text += r[0].transcript;
        final = final || r.isFinal;
      }
      onText(text.trim(), final);
    };
    rec.onerror = (e) => onError(e.error === "not-allowed" || e.error === "service-not-allowed" ? "Hace falta permiso para usar el micrófono." : e.error === "no-speech" ? "No escuché nada. Probá de nuevo." : "No pude usar el micrófono.");
    try {
      rec.start();
    } catch {
      rec = null;
      onState(false);
    }
  };
  return { toggle: () => (rec ? stop() : start()) };
}
