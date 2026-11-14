# mytempo en Google Play (Android)

La app web ya es instalable como PWA. Para tener los **avisos con la app cerrada** y publicarla en Google Play se
empaqueta con [Capacitor](https://capacitorjs.com/): el mismo código, dentro de una app Android. En `src/ui/notifications.js`
ya está el puente: si detecta `Capacitor.Plugins.LocalNotifications`, programa los avisos de los próximos 7 días en el
sistema; si no, usa las notificaciones del navegador como hasta ahora.

## Requisitos
- Node 18+, Android Studio (trae el SDK y el JDK) y un teléfono o emulador.

## Primera vez
```sh
npm install --save-dev @capacitor/core @capacitor/cli @capacitor/android
npm install @capacitor/local-notifications
sh scripts/build-www.sh        # copia la app a www/
npx cap add android            # crea la carpeta android/ (no se sube al repo)
npm run android:prepare        # copia www/ y sincroniza plugins
npx cap open android           # abre Android Studio
```
En Android Studio: **Run** para probarla en tu teléfono. Si querés el ícono de notificación propio, agregá
`ic_stat_icon` en `android/app/src/main/res/drawable`.

## Permisos
Android 13+ pide permiso de notificaciones (lo pide la app al activar los recordatorios). Para que los avisos lleguen
puntuales, agregá en `android/app/src/main/AndroidManifest.xml` `SCHEDULE_EXACT_ALARM` si el plugin lo requiere en
tu versión (ver la documentación del plugin).

## Publicar
1. Crear cuenta de desarrollador en Play Console (pago único de USD 25).
2. Generar un **Android App Bundle** firmado: Android Studio → Build → Generate Signed Bundle. Guardá el keystore
   fuera del repo (ya está en `.gitignore`).
3. Subir a una prueba cerrada. **Ojo:** las cuentas personales creadas después del 13/11/2023 deben hacer una prueba
   cerrada con **al menos 12 testers durante 14 días seguidos** antes de pedir acceso a producción
   ([fuente oficial](https://support.google.com/googleplay/android-developer/answer/14151465)).
4. Completar ficha, política de privacidad (la app no envía datos: todo queda en el teléfono) y pedir producción.

## Privacidad
Las tareas y el perfil se guardan solo en el dispositivo. El dictado por voz usa el servicio de reconocimiento del
sistema; mytempo no recibe ni guarda el audio.
