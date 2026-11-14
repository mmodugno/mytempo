# Métricas y mytempo Plus

## Qué se mide (y qué no)

mytempo no tiene cuentas ni servidor: todo queda en el teléfono. Por eso las métricas son mínimas y de **permiso explícito**:

- **Contadores locales:** cada vez que alguien abre la hoja de Plus, toca un accesorio con candadito o toca "Me interesa", se suma uno en el teléfono (`mytempo.metrics`). No sale de ahí.
- **Envío anónimo (opcional):** solo si la persona activa **Ajustes → Privacidad → Compartir uso anónimo** (apagado por defecto) *y* hay una dirección en `src/config.js` (`METRICS_URL`), se envía un mensaje por evento:

```json
{ "event": "plus_lock_tap", "feature": "cape", "from": "vestidor", "day": "2026-11-13", "v": 1 }
```

No hay identificador de persona ni de dispositivo, ni tareas, ni horarios, ni textos. Solo existen los eventos de `src/engine/plus.js` (`plus_open`, `plus_lock_tap`, `plus_interest`, `plus_demo_on`), y los tests verifican que nada más se cuenta ni se envía.

## Cómo recibirlas

Mientras `METRICS_URL` esté vacío no se envía nada a ningún lado. Para recibirlas hace falta un lugar que acepte un `POST` de texto, por ejemplo:

1. Un contador de visitas/eventos que acepte llamadas HTTP (hay servicios gratuitos o de bajo costo; revisá su política de privacidad antes).
2. Una función serverless propia (Cloudflare Workers, Netlify, etc.) que sume los eventos por día.

Cualquiera de las dos opciones implica declararlo en la ficha de Play (sección **Seguridad de los datos**) y en la política de privacidad.

## Lo que ya te da Google Play, sin tocar nada

La Play Console muestra instalaciones, desinstalaciones, calificaciones y, cuando exista la compra, suscriptores e ingresos. Eso alcanza para el día a día; las métricas de Plus sirven para saber **qué** función les interesa.

## Antes de publicar la versión de Plus

- El **modo prueba** (Plus gratis) solo existe en la web (localhost o `?plusdemo`) y está bloqueado dentro de la app de Android; hay tests para eso.
- El acceso a Plus se guarda aparte del perfil (`mytempo.plus`), así que ni se exporta ni se puede activar importando un respaldo.
- Falta conectar la **compra real** con Google Play Billing (por ejemplo con un plugin de Capacitor) y llamar a `setPlus(true, "play")` al verificar la compra. Mientras tanto, Plus no se cobra y la hoja dice "Próximamente en Google Play".
- Para que alguien con el teléfono modificado no pueda activarlo a mano, la verificación definitiva de la compra debería hacerse contra Google (servidor o plugin que valide la firma).
