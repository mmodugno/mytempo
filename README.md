# mytempo

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

## Estructura

```
src/engine/   motor del plan (funciones puras, sin DOM)
src/store/    perfil y almacenamiento local
src/ui/       pantallas
data/         perfil de ejemplo
test/         tests
```

## Estado

- [x] Esqueleto del proyecto
- [ ] Perfil y onboarding
- [ ] Motor del plan
- [ ] Pantalla "Ahora" y check-ins
- [ ] Resumen semanal y aprendizaje de energía
- [ ] Voz
- [ ] Publicación en Google Play

## Licencia

MIT
