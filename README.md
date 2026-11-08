# mytempo

[![CI](https://github.com/mmodugno/mytempo/actions/workflows/ci.yml/badge.svg)](https://github.com/mmodugno/mytempo/actions/workflows/ci.yml)

Un planner automático que conoce tus horarios y tu energía, y organiza tus tareas por vos.

> En construcción (MVP). Pensado para el celular, funciona como PWA y guarda todo **solo en tu dispositivo**.

## Idea

Planificar a mano cada día cansa, y casi siempre termino poniendo tareas pesadas cuando estoy cansada y tareas livianas cuando tengo la cabeza clara. mytempo:

- conoce tus horarios fijos (trabajo, viajes, clases, compromisos),
- aprende en qué momentos rendís mejor,
- asigna las tareas exigentes a tus momentos de más claridad y las livianas a los de menos energía,
- replanifica solo, sin reproches, si algo no sale como estaba previsto.

## Principios

- Simple y rápida: pocos toques, nada de formularios largos.
- Tono amable: si no llegás a algo, el plan se acomoda sin culpa.
- El plan es un apoyo, con pausas y tiempo libre incluidos.
- Privacidad primero: sin cuentas ni servidores, los datos quedan en tu teléfono.
- Modular: el motor es independiente de la interfaz, para sumar otros módulos más adelante.

## Stack

- JavaScript (ES modules), sin framework ni paso de build
- PWA (manifest + service worker)
- Tests con el runner nativo de Node (`node --test`)
- GitHub Pages + GitHub Actions

## Correrlo

```bash
npm start      # servidor estático en http://localhost:8080
npm test       # tests del motor
```

## Cómo funciona el plan

El motor (`src/engine/planner.js`) es una función pura: `plan(perfil, tareas, ahora)`. Cada tarea apunta a un nivel de energía según su esfuerzo (exigente → momentos de alta energía, liviana → momentos bajos), se ordena por fecha límite y prioridad, y se respeta siempre el tiempo libre que pediste. Un check-in reciente desplaza la curva de energía durante las próximas horas. Replanificar es volver a llamar a la función con las tareas actualizadas.

## Estructura

```
src/engine/   plan, energía, aprendizaje, estimación, racha y puntos, resumen, repeticiones, recordatorios y parser (puro, sin DOM)
src/store/    perfil, rutina diaria y almacenamiento local
src/ui/       pantallas
data/         perfil de ejemplo
test/         tests
```

## Funciones

- **Plan automático** según tu energía, tus horarios fijos, fechas límite y prioridades, con pausas y tiempo libre protegido.
- **Aprende de vos:** tus check-ins (energía y foco, dos toques) ajustan tu curva de energía; los datos viejos pesan cada vez menos.
- **Resumen semanal:** qué lograste, cuándo rendís mejor y sugerencias amables.
- **Carga rápida en una línea:** `Lavar la ropa 30m #liviana cada semana` (duración, esfuerzo, fecha, prioridad y repetición).
- **Tareas repetidas** (diarias, semanales, cada 2 semanas, mensuales) y **pasos** (subtareas) con checklist.
- **Compromisos de un día** (un curso, un turno) y horarios fijos semanales.
- **Recordatorios** antes de cada tarea (con la app abierta o en segundo plano).
- **Duraciones realistas:** estima cuánto lleva cada tarea (lavar los platos ≈ 10 min, estudiar ≈ 1 h 30) y aprende de lo que realmente tardás.
- **Rutina diaria ya cargada:** elegís lo que hacés todos los días en el onboarding y aparece solo; se puede pausar o sumar más en Ajustes.
- **Mascota y racha:** un pomerania que festeja cada tarea, puntos, niveles y una racha de días seguidos con día de descanso semanal y accesorios que se desbloquean.
- **El día como una curva:** tu energía, tus horarios y tus tareas en un solo gráfico; la curva se hunde si marcás cansancio.
- Modo claro y oscuro, instalable (PWA), funciona sin conexión, exporta e importa tus datos en JSON.

## Estado

- [x] Esqueleto, perfil personalizable y onboarding
- [x] Motor del plan con tests
- [x] Pantalla "Ahora", check-ins y replanificación
- [x] Carga rápida, tareas repetidas y pasos
- [x] Aprendizaje de energía y resumen semanal
- [x] Compromisos de un día
- [x] Recordatorios (web)
- [x] Identidad visual: curva de energía
- [ ] Voz
- [ ] Recordatorios con la app cerrada (requieren la versión Android o un servidor de push)
- [ ] Publicación en Google Play

## Licencia

MIT
