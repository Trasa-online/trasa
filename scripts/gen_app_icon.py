#!/usr/bin/env python3
"""Ikona aplikacji + sciezki znaku z NOWEGO logo (public/Logo_Spontaway.jpg, 2026-09-15).

Zrodlem prawdy jest jeden plik od Nat: plaskie zolte tlo `#FDF184` i pomaranczowy znak
`#F75708` - faliste "S" z GWIAZDKA w prawym gornym rogu (do 15.09 stala tam pinezka).
Wszystko inne liczymy z niego, zeby nie bylo drugiego, recznie utrzymywanego mastera.

Co powstaje:
  public/App icon IOS.png            1024  - master ikony (kopia zrodla w PNG)
  public/icon-512.png, icon-192.png        - PWA
  public/apple-touch-icon.png         180
  public/favicon.png                   48
  public/favicon.ico                   48  - stare przegladarki i zakladki
  public/Avatar_Trasa.png             512  - domyslny awatar = ta sama ikona (DEFAULT_AVATAR)
  ios/.../AppIcon-512@2x.png         1024  - ikona iOS
  src/components/spontawayMarkPaths.ts     - "S" i gwiazdka jako SCIEZKI, w jednym ukladzie

⛔ Splash (`ios/.../Splash.imageset`) NIE jest tu generowany: od 2026-09-01 natywny ekran
startowy to JEDNOLITE tlo `#FEFEFE` bez znaku, bo znak rysuje React (`SplashDraw`). Gdyby
natywny ekran niosl logo, w momencie podmiany widac by bylo skok rozmiaru albo dwa loga naraz.

Po co osobne sciezki dla "S" i gwiazdki: ekran ladowania rysuje "S" od lewej, a NA KONIEC
zapala gwiazdke (prosba Nat 2026-09-15). Jedna maska calego znaku nie pozwala animowac samej
gwiazdki, a `-webkit-mask-image` w animowanej warstwie WebKit na iOS gubi - stad sciezki
inline zamiast bitmap (patrz `trace_mark_svg.py`).

Alfa liczona z ODLEGLOSCI OD ZOLTEGO, nie progiem 0/1: zrodlo to JPEG, wiec krawedzie maja
artefakty kompresji, a rampa daje gladki brzeg przed obrysem.

Uruchomienie:  python3 scripts/gen_app_icon.py
"""
from pathlib import Path
from PIL import Image
from trace_mark_svg import trace_alpha

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "Logo_Spontaway.jpg"
PUBLIC = ROOT / "public"
IOS_ICON = ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset"
OUT_TS = ROOT / "src/components/spontawayMarkPaths.ts"

YELLOW = (253, 241, 133)   # tlo marki #FDF184
# Rampa alfy: ponizej LO piksel jest tlem, powyzej HI pelnym znakiem.
LO, HI = 40.0, 140.0


def alpha_from_yellow(img: Image.Image) -> Image.Image:
    """Maska alfa = jak daleko piksel jest od koloru tla."""
    rgb = img.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    mask = Image.new("L", (w, h))
    mp = mask.load()
    for y in range(h):
        for x in range(w):
            r, g, b = px[x, y]
            d = abs(r - YELLOW[0]) + abs(g - YELLOW[1]) + abs(b - YELLOW[2])
            mp[x, y] = 0 if d <= LO else (255 if d >= HI else int((d - LO) / (HI - LO) * 255))
    return mask


def split_components(mask: Image.Image) -> tuple[Image.Image, Image.Image]:
    """Rozdziela maske na dwie skladowe spojne: wieksza = "S", mniejsza = gwiazdka.

    Zamiast wpisywac wspolrzedne na sztywno szukamy ich w obrazie - gdyby Nat przesunela
    gwiazdke w kolejnej wersji logo, skrypt nadal ja znajdzie.
    """
    w, h = mask.size
    mp = mask.load()
    seen = [[False] * w for _ in range(h)]
    comps: list[list[tuple[int, int]]] = []
    for sy in range(h):
        for sx in range(w):
            if seen[sy][sx] or mp[sx, sy] < 24:
                continue
            stack, comp = [(sx, sy)], []
            seen[sy][sx] = True
            while stack:
                cx, cy = stack.pop()
                comp.append((cx, cy))
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = cx + dx, cy + dy
                    if 0 <= nx < w and 0 <= ny < h and not seen[ny][nx] and mp[nx, ny] >= 24:
                        seen[ny][nx] = True
                        stack.append((nx, ny))
            comps.append(comp)
    comps.sort(key=len, reverse=True)
    assert len(comps) >= 2, f"oczekiwano 'S' i gwiazdki, znaleziono {len(comps)} ksztaltow"
    out = []
    for comp in comps[:2]:
        m = Image.new("L", (w, h), 0)
        q = m.load()
        for x, y in comp:
            q[x, y] = mp[x, y]
        out.append(m)
    return out[0], out[1]   # (S, gwiazdka)


def layer(mask: Image.Image) -> Image.Image:
    """Warstwa RGBA (sam ksztalt) - do obrysu potrzebny jest tylko kanal alfa."""
    im = Image.new("RGBA", mask.size, (0, 0, 0, 255))
    im.putalpha(mask)
    return im


def main() -> None:
    src = Image.open(SRC).convert("RGB")
    assert src.size == (1024, 1024), f"zrodlo ma byc 1024x1024, jest {src.size}"

    # ── Ikona: zrodlo JEST juz gotowa ikona (tlo + znak), wiec tylko przeskalowania ──
    src.save(PUBLIC / "App icon IOS.png")
    for name, size in (("icon-512.png", 512), ("icon-192.png", 192),
                       ("apple-touch-icon.png", 180), ("favicon.png", 48),
                       # Domyslny awatar = ta sama ikona (`DEFAULT_AVATAR` w src/lib/avatar.ts).
                       # To NIE sa presety awatarow - te sa same kolory, bez znaku (decyzja Nat).
                       ("Avatar_Trasa.png", 512)):
        src.resize((size, size), Image.LANCZOS).save(PUBLIC / name)
    src.resize((48, 48), Image.LANCZOS).save(PUBLIC / "favicon.ico", sizes=[(48, 48), (32, 32), (16, 16)])
    IOS_ICON.mkdir(parents=True, exist_ok=True)
    src.save(IOS_ICON / "AppIcon-512@2x.png")

    # ── Sciezki znaku, wszystkie w JEDNYM ukladzie wspolrzednych (bbox calego znaku) ──
    mask = alpha_from_yellow(src)
    s_mask, star_mask = split_components(mask)
    (mx0, my0, mx1, my1) = mask.getbbox()
    (sx0, sy0, sx1, sy1) = s_mask.getbbox()
    (tx0, ty0, tx1, ty1) = star_mask.getbbox()
    mw, mh = mx1 - mx0, my1 - my0

    s_path = trace_alpha(layer(s_mask).crop((sx0, sy0, sx1, sy1)), (sx0 - mx0, sy0 - my0))
    star_path = trace_alpha(layer(star_mask).crop((tx0, ty0, tx1, ty1)), (tx0 - mx0, ty0 - my0))

    OUT_TS.write_text(f'''// WYGENEROWANE przez scripts/gen_app_icon.py z public/Logo_Spontaway.jpg - NIE edytuj recznie.
//
// Znak spontaway rozlozony na dwie warstwy w JEDNYM ukladzie wspolrzednych (`MARK_W` x `MARK_H`),
// zeby ekran ladowania mogl animowac gwiazdke niezaleznie od "S", a mimo to obie stanely
// wzgledem siebie dokladnie tak, jak w logo. Konsument: {OUT_TS.parent.name}/SpontawayMark.tsx.

/** Uklad wspolrzednych = ramka calego znaku (bez zoltego tla). */
export const MARK_W = {mw};
export const MARK_H = {mh};

/** Faliste "S" - korpus znaku. */
export const MARK_S_PATH =
  "{s_path}";

/** Gwiazdka z prawego gornego rogu (do 15.09.2026 byla tu pinezka). */
export const MARK_STAR_PATH =
  "{star_path}";

/** Ramka samej gwiazdki w ukladzie znaku - ekran ladowania skaluje ja z jej wlasnego srodka. */
export const MARK_STAR_BOX = {{ x: {tx0 - mx0}, y: {ty0 - my0}, w: {tx1 - tx0}, h: {ty1 - ty0} }};
''')

    print(f"ikona:  1024/512/192/180/48 + iOS AppIcon")
    print(f"znak:   {mw}x{mh}  S={sx1-sx0}x{sy1-sy0} ({len(s_path)} zn.)  "
          f"gwiazdka={tx1-tx0}x{ty1-ty0} ({len(star_path)} zn.)")
    print(f"zapis:  {OUT_TS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
