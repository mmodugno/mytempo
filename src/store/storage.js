// Almacenamiento local. Todo queda en el dispositivo (sin cuentas ni servidores).
// El "backend" es inyectable: en el navegador usa localStorage, en los tests un objeto en memoria.

import { defaultProfile, validateProfile, PROFILE_VERSION } from "./profile.js";

const KEYS = {
  profile: "mytempo.profile",
  tasks: "mytempo.tasks",
  checkins: "mytempo.checkins",
};

export function memoryBackend() {
  const data = new Map();
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
}

export function createStore(backend) {
  const read = (key, fallback) => {
    try {
      const raw = backend.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch {
      return fallback; // dato corrupto: arrancamos limpio antes que romper la app
    }
  };
  const write = (key, value) => backend.setItem(key, JSON.stringify(value));

  return {
    hasProfile: () => backend.getItem(KEYS.profile) !== null,

    getProfile() {
      return read(KEYS.profile, null) ?? defaultProfile();
    },
    saveProfile(profile) {
      const errors = validateProfile(profile);
      if (errors.length) throw new Error(errors.join(" "));
      write(KEYS.profile, profile);
    },

    getTasks: () => read(KEYS.tasks, []),
    saveTasks: (tasks) => write(KEYS.tasks, tasks),

    getCheckins: () => read(KEYS.checkins, []),
    addCheckin(checkin) {
      const all = read(KEYS.checkins, []);
      all.push({ energy: checkin.energy, focus: checkin.focus ?? null, at: checkin.at.toISOString() });
      write(KEYS.checkins, all.slice(-500)); // alcanza para detectar patrones, sin crecer sin límite
    },

    /** Todo en un solo JSON, para respaldo o para pasar de un dispositivo a otro. */
    exportAll() {
      return JSON.stringify(
        {
          app: "mytempo",
          version: PROFILE_VERSION,
          exportedAt: new Date().toISOString(),
          profile: this.getProfile(),
          tasks: this.getTasks(),
          checkins: this.getCheckins(),
        },
        null,
        2
      );
    },

    /** Importa un respaldo (o un perfil suelto, como data/perfil-ejemplo.json). */
    importAll(json) {
      let data;
      try {
        data = JSON.parse(json);
      } catch {
        throw new Error("El archivo no es un JSON válido.");
      }
      const profile = data.profile ?? (data.wake ? data : null);
      if (!profile) throw new Error("No encontré un perfil en el archivo.");
      const errors = validateProfile(profile);
      if (errors.length) throw new Error(errors.join(" "));
      write(KEYS.profile, profile);
      if (Array.isArray(data.tasks)) write(KEYS.tasks, data.tasks);
      if (Array.isArray(data.checkins)) write(KEYS.checkins, data.checkins);
    },

    clearAll() {
      Object.values(KEYS).forEach((k) => backend.removeItem(k));
    },
  };
}
