#!/usr/bin/env sh
# Copia la app web (sin build) a www/, que es lo que empaqueta Capacitor.
set -e
rm -rf www && mkdir www
cp -r index.html manifest.webmanifest styles.css sw.js src icons www/
echo "www/ listo"
