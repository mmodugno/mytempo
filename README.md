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
src/engine/   motor del plan y parser de carga rápida (funciones puras, sin DOM)
src/store/    perfil y almacenamiento local
src/ui/       pantallas
data/         perfil de ejemplo
test/         tests
```

## Estado

- [x] Esqueleto del proyecto
- [x] Perfil personalizable y onboarding
- [x] Motor del plan (energía, horarios fijos, fechas límite, tiempo libre)
- [x] Pantalla "Ahora", check-ins de energía y replanificación
- [x] Carga rápida de tareas en una línea (`Estudiar 1h30 #exigente mañana !`)
- [ ] Resumen semanal y aprendizaje de energía
- [ ] Voz
- [ ] Publicación en Google Play

## Licencia

MIT
