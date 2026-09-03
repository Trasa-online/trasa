#!/usr/bin/env python3
"""
Backfill miniatur dla plikow, ktore juz leza w Storage.

Po co: od 2026-09-03 apka czyta miniatury jako PLIKI zapisane obok oryginalu
(`<sciezka>.thumb`, patrz src/lib/imageThumbs.ts), zamiast przerabiac oryginal w locie
platna funkcja "Storage Image Transformations". Zdjecia wgrane wczesniej swojej miniatury
nie maja - bez tego skryptu apka spadalaby dla nich na oryginal (srednio 1-3 MB na kafelek).

Dlaczego skalujemy LOKALNIE, a nie przez /render/image: tamta sciezka to wlasnie ta platna
funkcja. Puszczenie przez nia 1883 plikow doliczyloby 1883 "obrazy zrodlowe" do rachunku,
a przy wlaczonym spend cap zwyczajnie by sie zablokowala w polowie. Pobranie oryginalu
kosztuje tylko transfer, ktory i tak miesci sie w planie.

Skrypt jest wznawialny: pliki, ktore juz maja miniature, sa pomijane.

Uruchomienie:  python3 scripts/backfill-thumbs.py [--dry-run] [--bucket route-images]
Wymaga:        SUPABASE_ACCESS_TOKEN i SUPABASE_SERVICE_ROLE_KEY w .env
"""
from __future__ import annotations

import io
import urllib.parse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from PIL import Image, ImageOps

PROJECT_REF = "chxphfcpehxshvijqtlf"
STORAGE = "https://api.spontaway.com/storage/v1"
THUMB_SUFFIX = ".thumb"          # 1:1 z src/lib/imageThumbs.ts
THUMB_SIDE = 800                 # 1:1 z src/lib/imageThumbs.ts
THUMB_QUALITY = 70
BUCKETS = ["route-images", "business-photos", "place-photos-cache", "place-photos", "avatars"]
WORKERS = 4

DRY = "--dry-run" in sys.argv
ONLY = None
if "--bucket" in sys.argv:
    ONLY = sys.argv[sys.argv.index("--bucket") + 1]


def env(name: str) -> str:
    for line in open(os.path.join(os.path.dirname(__file__), "..", ".env"), encoding="utf-8"):
        if line.startswith(name + "="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    sys.exit(f"brak {name} w .env")


ACCESS_TOKEN = env("SUPABASE_ACCESS_TOKEN")
SERVICE_KEY = env("SUPABASE_SERVICE_ROLE_KEY")


def sql(query: str):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query",
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": f"Bearer {ACCESS_TOKEN}", "Content-Type": "application/json",
                 "User-Agent": "trasa-backfill-thumbs/1.0"}, method="POST")
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.loads(r.read().decode())


def list_targets():
    """Pliki bez miniatury. Rozszerzenia filtrujemy w SQL, zeby nie ciagnac PDF-ow z menu."""
    buckets = ", ".join(f"'{b}'" for b in ([ONLY] if ONLY else BUCKETS))
    return sql(f"""
        SELECT o.bucket_id, o.name, (o.metadata->>'size')::bigint AS size
        FROM storage.objects o
        WHERE o.bucket_id IN ({buckets})
          AND o.name NOT LIKE '%{THUMB_SUFFIX}'
          AND lower(o.name) ~ '\\.(jpg|jpeg|png|webp|heic|heif)$'
          AND NOT EXISTS (
                SELECT 1 FROM storage.objects t
                WHERE t.bucket_id = o.bucket_id AND t.name = o.name || '{THUMB_SUFFIX}')
        ORDER BY (o.metadata->>'size')::bigint DESC NULLS LAST
    """)


def fetch(req, timeout=120, tries=4) -> bytes:
    """Storage potrafi zerwac polaczenie przy dluzszej serii (Errno 54). Bez ponawiania
    caly przebieg przewracal sie w polowie, wiec kazde zapytanie ma trzy dodatkowe szanse."""
    last = None
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.read()
        except urllib.error.HTTPError:
            raise                       # 404/403 to prawdziwy blad, nie warto ponawiac
        except Exception as e:
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise last


def make_thumb(raw: bytes) -> bytes | None:
    try:
        im = Image.open(io.BytesIO(raw))
        im = ImageOps.exif_transpose(im)          # telefony zapisuja obrot w EXIF
        im.thumbnail((THUMB_SIDE, THUMB_SIDE), Image.LANCZOS)
        if im.mode not in ("RGB", "L"):
            im = im.convert("RGB")
        out = io.BytesIO()
        im.save(out, "JPEG", quality=THUMB_QUALITY, optimize=True, progressive=True)
        return out.getvalue()
    except Exception as e:
        print(f"    [skala] {e}")
        return None


def process(row) -> tuple[str, int, int]:
    bucket, name = row["bucket_id"], row["name"]
    url = f"{STORAGE}/object/public/{bucket}/{urllib.parse.quote(name)}"
    try:
        raw = fetch(url)
    except urllib.error.HTTPError as e:
        return (f"POBRANIE {bucket}/{name}: HTTP {e.code}", 0, 0)
    except Exception as e:
        return (f"POBRANIE {bucket}/{name}: {e}", 0, 0)

    thumb = make_thumb(raw)
    if not thumb:
        return (f"SKALOWANIE {bucket}/{name}", 0, 0)
    if DRY:
        return ("", len(raw), len(thumb))

    req = urllib.request.Request(
        f"{STORAGE}/object/{bucket}/{urllib.parse.quote(name + THUMB_SUFFIX)}",
        data=thumb, method="POST",
        headers={"Authorization": f"Bearer {SERVICE_KEY}", "apikey": SERVICE_KEY,
                 "Content-Type": "image/jpeg", "x-upsert": "true",
                 "cache-control": "max-age=31536000"})
    try:
        fetch(req)
    except urllib.error.HTTPError as e:
        return (f"WGRANIE {bucket}/{name}: HTTP {e.code} {e.read()[:120].decode(errors='replace')}", 0, 0)
    except Exception as e:
        return (f"WGRANIE {bucket}/{name}: {e}", 0, 0)
    return ("", len(raw), len(thumb))


def main():
    rows = list_targets()
    print(f"plikow bez miniatury: {len(rows)}{'  (DRY RUN)' if DRY else ''}")
    if not rows:
        return
    errors, src_total, thumb_total, done = [], 0, 0, 0
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for err, a, b in pool.map(process, rows):
            done += 1
            if err:
                errors.append(err)
            else:
                src_total += a
                thumb_total += b
            if done % 100 == 0 or done == len(rows):
                print(f"  {done}/{len(rows)}  bledow: {len(errors)}")
    mb = lambda n: f"{n / 1024 / 1024:.1f} MB"
    print(f"\nzrobione: {done - len(errors)}   bledy: {len(errors)}")
    if src_total:
        print(f"oryginaly: {mb(src_total)}  ->  miniatury: {mb(thumb_total)}  "
              f"({src_total / max(thumb_total, 1):.0f}x mniej)")
    for e in errors[:20]:
        print("  !", e)


if __name__ == "__main__":
    main()
