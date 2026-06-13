#!/usr/bin/env python3
"""Generuje komplet zasobow z public/APP_Icon.png (ikona) + public/Icon_Trasa.png
(logo): iOS AppIcon (1024, bez alpha), web/PWA/favicon, oraz splash 2732 (gradient
brandowy + wycentrowane logo). Pillow."""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def p(*a): return os.path.join(ROOT, *a)

ICON_SRC = p("public", "APP_Icon.png")
LOGO_SRC = p("public", "Icon_Trasa.png")
ICONSET = p("ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset")
SPLASHSET = p("ios", "App", "App", "Assets.xcassets", "Splash.imageset")

icon = Image.open(ICON_SRC).convert("RGBA")
print("APP_Icon:", icon.size)

# ── iOS AppIcon: BEZ alpha (App Store), 1024, flatten na kolor naroznika ──
corner = icon.getpixel((0, 0))[:3]
flat = Image.new("RGB", icon.size, corner)
flat.paste(icon, mask=icon.split()[3])
icon1024 = flat.resize((1024, 1024), Image.LANCZOS)
for name in ("AppIcon-512@2x.png", "AppIcon-Dark.png", "AppIcon-Tinted.png"):
    icon1024.save(p(ICONSET, name))
print("iOS AppIcon -> 1024 (no alpha), corner bg", corner)

# ── web / PWA (alpha OK) ──
for size, name in [(1024, "app-icon-base.png"), (512, "icon-512.png"),
                   (192, "icon-192.png"), (180, "apple-touch-icon.png"), (48, "favicon.png")]:
    icon.resize((size, size), Image.LANCZOS).save(p("public", name))
icon.resize((64, 64), Image.LANCZOS).save(p("public", "favicon.ico"),
                                          sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
print("web/PWA + favicon.ico OK")

# ── splash 2732: tlo dobrane pod jasnosc logo, logo wycentrowane ──
logo = Image.open(LOGO_SRC).convert("RGBA")
a = logo.split()[3]
px = [logo.getpixel((x, y))[:3] for y in range(0, logo.height, 7) for x in range(0, logo.width, 7)
      if logo.getpixel((x, y))[3] > 40]
lum = sum(0.299*r+0.587*g+0.114*b for r, g, b in px) / max(1, len(px)) / 255
print("logo lum=%.2f (jasne>0.6 => tlo orange, ciemne => tlo bialawe)" % lum)

S = 2732
if lum > 0.6:
    top, bot = (244, 162, 89), (249, 102, 43)  # gradient brandowy #F4A259 -> #F9662B
    bg_hex = "#F9662B"
    col = Image.new("RGB", (1, S))
    for y in range(S):
        t = y/(S-1)
        col.putpixel((0, y), tuple(int(top[i]+(bot[i]-top[i])*t) for i in range(3)))
    splash = col.resize((S, S))
else:
    splash = Image.new("RGB", (S, S), (254, 254, 254))  # #FEFEFE
    bg_hex = "#FEFEFE"

lw = int(S*0.22); lh = int(logo.height*lw/logo.width)
logo_r = logo.resize((lw, lh), Image.LANCZOS)
splash.paste(logo_r, ((S-lw)//2, (S-lh)//2), logo_r)
for name in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
    splash.save(p(SPLASHSET, name))
print("splash 2732 OK, bg", bg_hex)
print("SPLASH_BG=" + bg_hex)
