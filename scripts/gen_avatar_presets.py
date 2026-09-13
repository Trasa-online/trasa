#!/usr/bin/env python3
"""Awatary brandowe do wyboru (prosba Nat 2026-09-13): SAME KOLORY z palety marki, bez znaku
(decyzja Nat tego samego dnia - pierwsza wersja miala faliste "S" na tle). Wynik:
public/avatars/preset-<id>.png (512 px). Kopie w buckecie `avatars/presets/v2/` (wersja w sciezce,
bo pliki ida z cache na rok - podmiana pod tym samym adresem nie dotarlaby do telefonow);
profil zapisuje pelny URL jak przy wlasnym zdjeciu. Adresy buduje src/lib/avatarPresets.ts."""
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "avatars")
S = 512

# (id, tlo: gradient gora->dol albo jeden kolor). "sun" = gradient ikony apki (zolty -> zloty).
PRESETS = [
    ("sun",        ((0xFD, 0xF1, 0x84), (0xFD, 0xCD, 0x84))),
    ("orange",     ((0xEE, 0x53, 0x07), (0xEE, 0x53, 0x07))),
    ("brick",      ((0xA6, 0x40, 0x2A), (0xA6, 0x40, 0x2A))),
    ("brown",      ((0x5B, 0x2C, 0x06), (0x5B, 0x2C, 0x06))),
    ("pink",       ((0xF3, 0xB7, 0xC0), (0xF3, 0xB7, 0xC0))),
    ("blush",      ((0xE8, 0xA9, 0x9C), (0xE8, 0xA9, 0x9C))),
    ("peach",      ((0xF6, 0xD9, 0xC6), (0xF6, 0xD9, 0xC6))),
    ("terracotta", ((0xC8, 0x83, 0x6E), (0xC8, 0x83, 0x6E))),
    ("gold",       ((0xFD, 0xCD, 0x84), (0xFD, 0xCD, 0x84))),
    ("purple",     ((0x7C, 0x3A, 0xED), (0x7C, 0x3A, 0xED))),
    ("blue",       ((0x2F, 0x6F, 0xED), (0x2F, 0x6F, 0xED))),
    ("green",      ((0x1F, 0x9D, 0x55), (0x1F, 0x9D, 0x55))),
]

os.makedirs(OUT, exist_ok=True)
for pid, (top, bot) in PRESETS:
    col = Image.new("RGB", (1, S))
    for y in range(S):
        t = y / (S - 1)
        col.putpixel((0, y), tuple(int(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    col.resize((S, S)).save(os.path.join(OUT, f"preset-{pid}.png"), optimize=True)
    print("ok", pid)
