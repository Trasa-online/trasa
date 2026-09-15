#!/usr/bin/env python3
"""Obrys ksztaltu z maski alfa do jednej gladkiej sciezki SVG.

Po co: ekran ladowania animuje GWIAZDKE osobno od "S", a `-webkit-mask-image` w animowanej
warstwie WebKit na iOS gubi (udokumentowane w CLAUDE.md przy nakladkach awatara i kafelkach
eksploracji). Znak musi wiec byc INLINE svg - czyli potrzebujemy sciezki, a nie bitmapy.
Potrace w tym srodowisku nie ma, wiec obrys liczymy sami.

Jak: obchod krawedzi pikseli regula prawej reki (schodki) -> Ramer-Douglas-Peucker (zrzuca
schodki do wierzcholkow) -> Catmull-Rom zamieniony na krzywe szescienne (zaokragla naroza
tak, jak narysowala je Nat).

Uzywa tego `gen_app_icon.py`; samodzielnie sluzy do podejrzenia pojedynczej warstwy:
  python3 scripts/trace_mark_svg.py /sciezka/warstwa.png /sciezka/podglad.svg
"""
import sys
from pathlib import Path
from PIL import Image

EPS = 1.5        # RDP w pikselach zrodla (1024)
# ⚠️ Nizej NIE znaczy wierniej: przy 0,9 obrys zaczyna lapac SCHODKI pikseli, wiec sciezka
# puchnie 4x, a pokrycie z prawdziwym ksztaltem SPADA. Zmierzone (IoU obrysu z maska):
#   EPS 0,9 -> gwiazdka 97,44 % / 5262 znaki      EPS 1,5 -> gwiazdka 97,75 % / 1269 znakow
#   EPS 2,5 -> gwiazdka 97,34 % / 852 znaki       ("S" trzyma 98,6-98,9 % w calym zakresie)
# 1,5 to maksimum wiernosci przy najmniejszej sciezce - a sciezki ida w paczke pierwszej klatki.
TENSION = 0.5    # Catmull-Rom: bazowe zaokraglenie (przy ostrym narozniku schodzi do 0)
# Prog "naroznika": cos kata miedzy odcinkami. Powyzej COS_SMOOTH traktujemy wierzcholek jak
# punkt gladkiej krzywej i zaokraglamy w pelni; ponizej COS_CORNER jak ostry naroznik i nie
# zaokraglamy wcale. Bez tego Catmull-Rom wygladzal KAZDY wierzcholek - lacznie z ostrymi
# wcieciami miedzy ramionami gwiazdki, ktore przez to robily sie plytkie i obce.
COS_CORNER, COS_SMOOTH = -0.2, 0.7

# Piksel po LEWEJ i po PRAWEJ stronie kroku z naroznika (x,y) w kierunku d.
# Piksel (i,j) zajmuje kwadrat od naroznika (i,j) do (i+1,j+1), os Y w dol.
SIDES = {
    (1, 0):  ((0, -1), (0, 0)),     # w prawo: nad krawedzia / pod krawedzia
    (0, 1):  ((0, 0), (-1, 0)),     # w dol:   na wschod     / na zachod
    (-1, 0): ((-1, 0), (-1, -1)),   # w lewo:  pod krawedzia / nad krawedzia
    (0, -1): ((-1, -1), (0, -1)),   # w gore:  na zachod     / na wschod
}


def outline(mask: list[list[bool]], w: int, h: int) -> list[tuple[int, int]]:
    """Obchod konturu zewnetrznego regula prawej reki (wypelnienie zawsze po prawej).

    Chodzimy po kratce NAROZNIKOW pikseli, wiec wynik to schodki - RDP zaraz je zrzuci
    do samych wierzcholkow ksztaltu.
    """
    start = next(((x, y) for y in range(h) for x in range(w) if mask[y][x]), None)
    if start is None:
        raise SystemExit("pusta maska")
    on = lambda x, y: 0 <= x < w and 0 <= y < h and mask[y][x]

    # Gorna krawedz pierwszego zapalonego piksela: nad nia pusto, pod nia wypelnienie.
    sx, sy, sd = start[0], start[1], (1, 0)
    px, py, d, steps = sx, sy, sd, 0
    pts: list[tuple[int, int]] = []
    while True:
        # Regula prawej reki: najpierw skret w prawo, potem prosto, w lewo, na koniec zawrot.
        for cand in ((-d[1], d[0]), d, (d[1], -d[0]), (-d[0], -d[1])):
            (lox, loy), (rox, roy) = SIDES[cand]
            if on(px + rox, py + roy) and not on(px + lox, py + loy):
                break
        else:
            raise SystemExit("obchod utknal")
        if cand != d:
            pts.append((px, py))          # wierzcholek tylko tam, gdzie kontur skreca
        # Kryterium Jacoba: konczymy na powrocie do STANU poczatkowego (punkt + kierunek),
        # nie do samego punktu - naroznik w przewezeniu potrafi wypasc dwa razy.
        if steps and (px, py) == (sx, sy) and cand == sd:
            return pts
        d = cand
        px, py = px + d[0], py + d[1]
        steps += 1
        if steps > 8 * w * h:
            raise SystemExit("obchod sie nie domknal")


def rdp(pts: list[tuple[float, float]], eps: float) -> list[tuple[float, float]]:
    """Ramer-Douglas-Peucker (iteracyjnie, bez rekurencji - kontur ma tysiace punktow)."""
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        ax, ay = pts[a]; bx, by = pts[b]
        ex, ey = bx - ax, by - ay
        n = (ex * ex + ey * ey) ** 0.5 or 1.0
        best, bi = -1.0, a
        for i in range(a + 1, b):
            x, y = pts[i]
            dist = abs(ey * (x - ax) - ex * (y - ay)) / n
            if dist > best:
                best, bi = dist, i
        if best > eps:
            keep[bi] = True
            stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]


def corner_tension(a: tuple[float, float], v: tuple[float, float], b: tuple[float, float],
                   t: float) -> float:
    """Ile zaokraglic w wierzcholku `v`: pelne `t` na gladkiej krzywej, 0 na ostrym narozniku."""
    ax, ay = v[0] - a[0], v[1] - a[1]
    bx, by = b[0] - v[0], b[1] - v[1]
    na = (ax * ax + ay * ay) ** 0.5
    nb = (bx * bx + by * by) ** 0.5
    if na == 0 or nb == 0:
        return 0.0
    cos = (ax * bx + ay * by) / (na * nb)     # 1 = prosto, -1 = zawrot
    k = (cos - COS_CORNER) / (COS_SMOOTH - COS_CORNER)
    return t * (0.0 if k < 0 else (1.0 if k > 1 else k))


def smooth_path(pts: list[tuple[float, float]], t: float = TENSION) -> str:
    """Catmull-Rom przez wierzcholki -> zamknieta sciezka z krzywych szesciennych.

    Napiecie liczymy OSOBNO dla kazdego konca odcinka (`corner_tension`), zeby gladkie luki
    zostaly gladkie, a ostre naroza - ostre.
    """
    n = len(pts)
    f = lambda v: f"{v:.1f}".rstrip("0").rstrip(".")
    d = [f"M{f(pts[0][0])} {f(pts[0][1])}"]
    for i in range(n):
        p0, p1, p2, p3 = pts[(i - 1) % n], pts[i], pts[(i + 1) % n], pts[(i + 2) % n]
        t1 = corner_tension(p0, p1, p2, t)
        t2 = corner_tension(p1, p2, p3, t)
        c1 = (p1[0] + (p2[0] - p0[0]) * t1 / 3, p1[1] + (p2[1] - p0[1]) * t1 / 3)
        c2 = (p2[0] - (p3[0] - p1[0]) * t2 / 3, p2[1] - (p3[1] - p1[1]) * t2 / 3)
        d.append(f"C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(p2[0])} {f(p2[1])}")
    return " ".join(d) + "Z"


def trace_alpha(img: Image.Image, origin: tuple[int, int] = (0, 0)) -> str:
    """Sciezka ksztaltu z kanalu alfa, we wspolrzednych PRZESUNIETYCH o `origin`.

    `origin` pozwala oddac kilka warstw w JEDNYM ukladzie wspolrzednych (calego znaku),
    zeby "S" i gwiazdka stanely wzgledem siebie dokladnie tak, jak w logo.
    """
    w, h = img.size
    a = img.split()[3].load()
    mask = [[a[x, y] >= 128 for x in range(w)] for y in range(h)]
    pts = [(float(x + origin[0]), float(y + origin[1])) for x, y in outline(mask, w, h)]
    pts = rdp(pts, EPS)
    if pts[0] == pts[-1]:
        pts.pop()
    return smooth_path(pts)


def main() -> None:
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    im = Image.open(src).convert("RGBA")
    im = im.crop(im.getbbox())
    path = trace_alpha(im)
    dst.write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {im.width} {im.height}">'
        f'<path fill="currentColor" d="{path}"/></svg>\n'
    )
    print(f"{dst.name}: {im.width}x{im.height} px, {len(path)} znakow sciezki")


if __name__ == "__main__":
    main()
