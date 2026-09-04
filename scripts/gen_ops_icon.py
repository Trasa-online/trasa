#!/usr/bin/env python3
"""Ikona panelu operacyjnego (admin.spontaway.com) = ODWROCONE kolory ikony aplikacji.

Ikona apki:  kafelek gradient zolto-zloty (#FDF184 -> #FDCD84) + POMARANCZOWE "S".
Ikona ops:   kafelek gradient pomaranczowy (#F75708 -> #F9662B) + ZOLTE "S" (#FDF184).

Po co: panel zapisany jako zakladka na ekranie domowym telefonu wygladal identycznie
jak apka i nie dalo sie ich rozroznic. Ten sam znak, zamienione kolory - od razu widac,
ze to rodzenstwo, a nie ta sama rzecz.

Zrodlo znaku: public/spontaway-symbol.png (przezroczyste tlo, przemalowywane na zolto).
Wynik: public/ops-icon-1024.png (master), ops-icon-180.png (ekran domowy iOS),
ops-favicon.png (zakladka w przegladarce). Uzycie: python3 scripts/gen_ops_icon.py
"""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def p(*a): return os.path.join(ROOT, *a)

S = 1024
BG_FROM, BG_TO = (247, 87, 8), (249, 102, 43)   # #F75708 -> #F9662B
SYMBOL = (253, 241, 132)                        # #FDF184
SYMBOL_FRAC = 0.62                              # tak samo jak kafelek w OpsLogo

sym = Image.open(p("public", "spontaway-symbol.png")).convert("RGBA")

# Tlo: gradient po przekatnej, jak w ikonie apki (tam zolty, tu pomaranczowy).
bg = Image.new("RGB", (S, S))
px = bg.load()
for y in range(S):
    for x in range(S):
        t = (x + y) / (2 * (S - 1))
        px[x, y] = tuple(int(BG_FROM[i] + (BG_TO[i] - BG_FROM[i]) * t) for i in range(3))

# Znak: bierzemy z pliku sama maske (kanal alfa) i malujemy nia na zolto.
paint = Image.new("RGBA", sym.size, SYMBOL + (0,))
paint.putalpha(sym.split()[3])
w = int(S * SYMBOL_FRAC)
h = int(sym.height * w / sym.width)
paint = paint.resize((w, h), Image.LANCZOS)

icon = bg.convert("RGBA")
icon.paste(paint, ((S - w) // 2, (S - h) // 2), paint)
icon = icon.convert("RGB")

for size, name in [(1024, "ops-icon-1024.png"), (180, "ops-icon-180.png"), (48, "ops-favicon.png")]:
    icon.resize((size, size), Image.LANCZOS).save(p("public", name))
    print("public/%s (%dx%d)" % (name, size, size))
