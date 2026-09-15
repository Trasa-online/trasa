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
  ios/.../AppIcon-<px>.png                 - KOMPLET rozmiarow iOS + Contents.json
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
import json
from pathlib import Path
from PIL import Image, ImageCms
from trace_mark_svg import trace_alpha

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "public" / "Logo_Spontaway.jpg"
PUBLIC = ROOT / "public"
IOS_ICON = ROOT / "ios/App/App/Assets.xcassets/AppIcon.appiconset"
OUT_TS = ROOT / "src/components/spontawayMarkPaths.ts"

YELLOW = (253, 241, 133)   # tlo marki #FDF184
ORANGE = (247, 87, 8)      # znak marki #F75708
# Rampa alfy: ponizej LO piksel jest tlem, powyzej HI pelnym znakiem.
LO, HI = 40.0, 140.0


def clean_two_tone(img: Image.Image, mask: Image.Image) -> Image.Image:
    """Przemalowuje ikone na DOKLADNIE dwa kolory marki, z gladka krawedzia.

    Po co: zrodlo to JPEG, wiec kazdy piksel jest "prawie" #F75708 (JPEG gubi +-2 na kanal),
    a na styku znaku z tlem chroma 4:2:0 zostawia obwodke posrednich odcieni w rodzaju
    (249,127,41) - przygaszonego pomaranczu. W pliku 1024 tego nie widac, ale obwodka biegnie
    wzdluz CALEGO "S", wiec po przeskalowaniu do 180 px na ekranie domowym (i po szklanej
    obrobce iOS-a) czyta sie jak poswiata albo gradient na znaku. Zgloszenie Nat 2026-09-15:
    „S ma na sobie jakis gradient... w pliku ktory Ci przeslalam jest jednolite logo".

    Kazdy piksel liczymy wiec od nowa jako mieszanke DOKLADNIE `YELLOW` i `ORANGE` wedlug
    maski - antyaliasing krawedzi zostaje, ale zaden inny odcien juz w pliku nie istnieje.
    """
    w, h = mask.size
    mp = mask.load()
    out = Image.new("RGB", (w, h))
    op = out.load()
    # Tablica 256 gotowych mieszanek - szybciej niz liczyc kolor per piksel.
    ramp = [tuple(round(YELLOW[c] + (ORANGE[c] - YELLOW[c]) * (a / 255)) for c in range(3))
            for a in range(256)]
    for y in range(h):
        for x in range(w):
            op[x, y] = ramp[mp[x, y]]
    return out


def resize_two_tone(icon: Image.Image, size: int) -> Image.Image:
    """Przeskalowanie, po ktorym w pliku NADAL sa tylko kolory marki.

    ⚠️ Sam LANCZOS nie wystarcza: to filtr wyostrzajacy, wiec na twardej granicy dwoch
    kolorow PRZESTRZELIWUJE (ringing). Przy skalowaniu 1024 -> 180 dawal np. (247,77,0) -
    pomarancz CIEMNIEJSZY niz marka - i to tuz przy krawedzi, wzdluz calego "S". Taka
    obwodka to dokladnie to, co widac na ekranie domowym jako poswiata na znaku.

    Dlatego po przeskalowaniu rzutujemy kazdy piksel z powrotem NA ODCINEK zolty-pomarancz.
    Udzial liczymy z kanalu ZIELONEGO, bo ma najwiekszy rozrzut (241 -> 87), wiec jest
    najmniej wrazliwy na zaokraglenia.
    """
    im = icon.resize((size, size), Image.LANCZOS)
    px = im.load()
    g0, g1 = YELLOW[1], ORANGE[1]
    for y in range(size):
        for x in range(size):
            t = (px[x, y][1] - g0) / (g1 - g0)
            t = 0.0 if t < 0 else (1.0 if t > 1 else t)
            px[x, y] = tuple(round(YELLOW[c] + (ORANGE[c] - YELLOW[c]) * t) for c in range(3))
    return im


# Komplet rozmiarow ikony iOS: (idiom, punkty, skala). Podajemy WSZYSTKIE, zeby `actool`
# nie musial niczego przeskalowywac - patrz `write_ios_iconset`.
IOS_ICON_SIZES = [
    ("iphone", 20, 2), ("iphone", 20, 3), ("iphone", 29, 2), ("iphone", 29, 3),
    ("iphone", 40, 2), ("iphone", 40, 3), ("iphone", 60, 2), ("iphone", 60, 3),
    ("ipad", 20, 1), ("ipad", 20, 2), ("ipad", 29, 1), ("ipad", 29, 2),
    ("ipad", 40, 1), ("ipad", 40, 2), ("ipad", 76, 1), ("ipad", 76, 2), ("ipad", 83.5, 2),
    ("ios-marketing", 1024, 1),
]


def write_ios_iconset(icon: Image.Image, icc: bytes) -> int:
    """Zapisuje KOMPLET rozmiarow ikony iOS + `Contents.json`.

    ⚠️ Po co, skoro Xcode umie zrobic rozmiary z jednego mastera 1024: bo robi to RINGUJACYM
    resamplerem. Przy katalogu z jednym plikiem `actool` oddawal ikone 120 px, w ktorej 899
    pikseli lezalo POZA kolorami marki - ciemniejsze (247,81,3) tuz WEWNATRZ krawedzi "S"
    i jasniejsze (253,248,138) tuz obok niej. Ciemny rant biegnacy wzdluz calego znaku czyta
    sie na ekranie domowym jak cieniowanie - to jest ten „gradient na S" zgloszony przez Nat
    2026-09-15. Gdy KAZDY rozmiar jest w katalogu gotowy, `actool` tylko go kopiuje i nie ma
    czego przestrzelic (skalujemy sami przez `resize_two_tone`, ktore rzutuje piksele na
    odcinek zolty-pomarancz).
    """
    for f in IOS_ICON.glob("*.png"):
        f.unlink()
    images, made = [], {}
    for idiom, pts, scale in IOS_ICON_SIZES:
        px = int(round(pts * scale))
        name = f"AppIcon-{px}.png"
        if px not in made:
            (icon if px == 1024 else resize_two_tone(icon, px)).save(IOS_ICON / name, icc_profile=icc)
            made[px] = name
        pt = f"{pts:g}x{pts:g}"
        images.append({"filename": made[px], "idiom": idiom, "scale": f"{scale}x", "size": pt})
    (IOS_ICON / "Contents.json").write_text(json.dumps(
        {"images": images, "info": {"author": "xcode", "version": 1}}, indent=2) + "\n")
    return len(made)


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

    mask = alpha_from_yellow(src)
    # ⛔ Ikona NIE jest kopia JPEG-a - przemalowujemy ja na dwa dokladne kolory marki, zeby
    # nie wiozla obwodki artefaktow JPEG wzdluz znaku (patrz `clean_two_tone`).
    icon = clean_two_tone(src, mask)
    # sRGB w metadanych: bez profilu iOS i actool musza ZGADYWAC przestrzen barw.
    srgb = ImageCms.createProfile("sRGB")
    icc = ImageCms.ImageCmsProfile(srgb).tobytes()

    for name, size in (("App icon IOS.png", 1024), ("icon-512.png", 512), ("icon-192.png", 192),
                       ("apple-touch-icon.png", 180), ("favicon.png", 48),
                       # Domyslny awatar = ta sama ikona (`DEFAULT_AVATAR` w src/lib/avatar.ts).
                       # To NIE sa presety awatarow - te sa same kolory, bez znaku (decyzja Nat).
                       ("Avatar_Trasa.png", 512)):
        im = icon if size == 1024 else resize_two_tone(icon, size)
        im.save(PUBLIC / name, icc_profile=icc)
    resize_two_tone(icon, 48).save(PUBLIC / "favicon.ico", sizes=[(48, 48), (32, 32), (16, 16)])
    IOS_ICON.mkdir(parents=True, exist_ok=True)
    n_ios = write_ios_iconset(icon, icc)

    # ── Sciezki znaku, wszystkie w JEDNYM ukladzie wspolrzednych (bbox calego znaku) ──
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

    print(f"ikona:  1024/512/192/180/48 + iOS AppIcon ({n_ios} rozmiarow, bez skalowania przez Xcode)")
    print(f"znak:   {mw}x{mh}  S={sx1-sx0}x{sy1-sy0} ({len(s_path)} zn.)  "
          f"gwiazdka={tx1-tx0}x{ty1-ty0} ({len(star_path)} zn.)")
    print(f"zapis:  {OUT_TS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
