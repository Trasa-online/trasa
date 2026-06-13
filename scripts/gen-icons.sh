#!/usr/bin/env bash
# Generuje WSZYSTKIE ikony aplikacji z jednego zrodla (kwadratowy PNG, najlepiej
# 1024x1024). Uzywa macOS `sips`. Uzycie:  bash scripts/gen-icons.sh [src.png]
# Domyslnie zrodlo: public/app-icon-base.png
set -euo pipefail

SRC="${1:-public/app-icon-base.png}"
[ -f "$SRC" ] || { echo "Brak pliku zrodlowego: $SRC"; exit 1; }

ICONSET="ios/App/App/Assets.xcassets/AppIcon.appiconset"

echo "Zrodlo: $SRC"
sips -g pixelWidth -g pixelHeight "$SRC" | tail -2

# ── iOS AppIcon (1024x1024, 3 warianty: main / dark / tinted) ──
sips -s format png -z 1024 1024 "$SRC" --out "$ICONSET/AppIcon-512@2x.png" >/dev/null
cp "$ICONSET/AppIcon-512@2x.png" "$ICONSET/AppIcon-Dark.png"
cp "$ICONSET/AppIcon-512@2x.png" "$ICONSET/AppIcon-Tinted.png"

# ── Web / PWA (public/) ──
sips -s format png -z 1024 1024 "$SRC" --out "public/app-icon-base.png" >/dev/null
sips -s format png -z 512  512  "$SRC" --out "public/icon-512.png"        >/dev/null
sips -s format png -z 192  192  "$SRC" --out "public/icon-192.png"        >/dev/null
sips -s format png -z 180  180  "$SRC" --out "public/apple-touch-icon.png">/dev/null
sips -s format png -z 48   48   "$SRC" --out "public/favicon.png"         >/dev/null

echo "OK. Wygenerowano: iOS AppIcon (main/dark/tinted) + public/{app-icon-base,icon-512,icon-192,apple-touch-icon,favicon}.png"
echo "UWAGA: favicon.ico nie jest regenerowane (sips nie tworzy .ico) - favicon.png wystarcza w nowoczesnych przegladarkach."
