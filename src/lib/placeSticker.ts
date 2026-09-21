// NAKLADKA MIEJSCA NA INSTAGRAM STORIES (prosba Nat 2026-09-21): kompozycja wlepek na cala
// relacje 9:16 - gwiazdki z kolorowymi obwodkami (albo sam obrys „kreda") + zolta pigulka
// „@handle". Trafia do edytora relacji jako naklejka przez natywny most (instagramStories.ts),
// a `drawStoryPreview` rysuje tym samym kodem miniatury wyboru zestawu w StoriesSheet - wiec
// to, co user widzi, jest co do piksela tym, co laduje na relacji.
//
// Panel „Nakladka" z pobieraniem PNG / GIF zostal ZDJETY 2026-09-21 wieczor (decyzja Nat) -
// ruchome naklejki ida przez kanal marki na GIPHY (scripts/giphy/stickers.ts korzysta
// z `drawStar` / `drawStarChalk` stad).
//
// Font: Sigmar (font-brand) - `document.fonts.load` PRZED pierwszym rysowaniem, inaczej canvas
// bierze zapasowy krój i nakladka wyglada inaczej niz w podgladzie.
import { STAR_PATH } from "@/components/BrandStar";

export const STICKER_YELLOW = "#FDF184";
export const STICKER_BROWN = "#5B2C06";
export const STICKER_ORANGE = "#F75708";

// NAKLADKA = CALA RELACJA 9:16 (1080 x 1920 jednostek logicznych), przezroczysta poza elementami:
// trzy gwiazdki z kolorowymi obwodkami (rozowa, zolta, zielona) rozrzucone jak wlepki po kadrze
// + pigulka „@handle" (biala obwodka, BEZ gwiazdki w srodku) w prawym dolnym rogu - uklad
// z referencji Nat (relacja z jedzeniem, 2026-09-21). User kladzie ja na swoim zdjeciu jako
// jedna warstwe; w GIF-ie gwiazdki obracaja sie i pulsuja, pigulka stoi.
export const OVERLAY_W = 1080;
export const OVERLAY_H = 1920;
const PILL_H = 150;
const PAD_X = 46;
const FONT_PX = 96;
const OUTLINE = 14;
const STAR_VB = { w: 468.64, h: 424.15 };
export const STAR_PINK = "#FF5FA2";
export const STAR_GREEN = "#3CC46F";

let starPath: Path2D | null = null;
const getStarPath = () => (starPath ??= new Path2D(STAR_PATH));

// Slowa, ktore w nazwie z Google sa LOKALIZACJA, nie nazwa lokalu („FALLA Warszawa Śródmieście",
// „Pierogarnia Mandu Gdańsk Śródmieście") - do handle nie wchodza. Miasto podaje wolajacy.
const LOCATION_WORDS = new Set([
  "srodmiescie", "wola", "mokotow", "praga", "ochota", "zoliborz", "ursynow", "wilanow", "bemowo", "bielany",
  "wrzeszcz", "oliwa", "zaspa", "garnizon", "kazimierz", "podgorze", "centrum", "stare", "nowe", "miasto",
  "warsaw", "cracow", "krakow", "warszawa", "gdansk", "gdynia", "sopot", "wroclaw", "poznan", "lodz", "katowice",
  "polska", "poland",
]);
const HANDLE_MAX = 20;
const ascii = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l").replace(/Ł/g, "L").toLowerCase();

/**
 * Handle na nakladce: instagram lokalu, a gdy go nie ma - nazwa miejsca „po instagramowemu".
 * Nazwy z Google niosa dopiski (miasto, dzielnica, „- Restauracja Sushi"), przez ktore pigulka
 * wychodzila „...rszawasrodmiescie" poza kadr (zgloszenie Nat 2026-09-21). Bierzemy czesc PRZED
 * myslnikiem / kreska / przecinkiem / nawiasem, wyrzucamy miasto i slowa-lokalizacje, a potem
 * doklejamy slowa, dopoki miesza sie w 20 znakach (co najmniej pierwsze slowo).
 */
export function stickerHandle(place: { place_name?: string | null; businessInstagram?: string | null; city?: string | null }): string {
  const ig = (place.businessInstagram ?? "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "");
  if (ig) return ig.toLowerCase().slice(0, 30);
  const head = (place.place_name ?? "").split(/\s+[-|–]\s+|\s*[,(|]/)[0] ?? "";
  const cityWords = new Set(ascii(place.city ?? "").split(/[^a-z0-9]+/).filter(Boolean));
  const words = ascii(head).split(/[^a-z0-9]+/).filter(Boolean)
    .filter((w) => !cityWords.has(w) && !LOCATION_WORDS.has(w));
  let out = "";
  for (const w of words) {
    if (out && (out + w).length > HANDLE_MAX) break;
    out += w;
  }
  return (out || "spontaway").slice(0, HANDLE_MAX + 4);
}

export async function ensureStickerFont(): Promise<void> {
  try { await document.fonts.load(`400 ${FONT_PX}px Sigmar`); } catch { /* zapasowy kroj */ }
}

const FONT = `400 ${FONT_PX}px Sigmar, "Baloo 2", system-ui, sans-serif`;
const MAX_PILL_W = OVERLAY_W - 120; // pigulka nie moze wyjsc poza relacje (60 px marginesu z obu stron)
const MIN_FONT_PX = 52;

/** Krój pigulki: 96 px, a przy dlugim handle mniejszy, zeby pigulka zmiescila sie w kadrze. */
function pillFont(ctx: CanvasRenderingContext2D, handle: string): string {
  ctx.font = FONT;
  const w = ctx.measureText(`@${handle}`).width + PAD_X * 2;
  if (w <= MAX_PILL_W) return FONT;
  const px = Math.max(MIN_FONT_PX, Math.floor(FONT_PX * (MAX_PILL_W - PAD_X * 2) / (w - PAD_X * 2)));
  return `400 ${px}px Sigmar, "Baloo 2", system-ui, sans-serif`;
}

// "full" = gwiazdki + pigulka (uklad z referencji), "alt" = te same gwiazdki w INNYM ukladzie
// (klaster u gory po lewej + jedna nad pigulka), "pill" = sama pigulka bez gwiazdek. Trzy zestawy
// do przeklikania (prosba Nat 2026-09-21) - w Stories i w panelu pobierania.
// "chalk" = SAM OBRYS gwiazdek, jak pisane kreda (miekki, ziarnisty bialy slad, bez wypelnienia;
// prosba Nat 2026-09-21) - uklad jak "full", pigulka bez zmian.
export type StickerVariant = "full" | "alt" | "chalk" | "pill";
export const STICKER_VARIANTS: StickerVariant[] = ["full", "alt", "chalk", "pill"];
export function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, rot: number, scale: number, outline: number, outlineColor: string, shadow = true) {
  const k = size / STAR_VB.w;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.translate(-STAR_VB.w * k / 2, -STAR_VB.h * k / 2);
  ctx.scale(k, k);
  const p = getStarPath();
  ctx.lineJoin = "round";
  ctx.lineWidth = outline / k;
  ctx.strokeStyle = outlineColor;
  if (shadow) {
    // Cien tylko pod obwodka (jeden raz) - nalepiona wlepka, nie plaski wektor.
    ctx.shadowColor = "rgba(0,0,0,0.30)";
    ctx.shadowBlur = 16 / k; ctx.shadowOffsetX = 4 / k; ctx.shadowOffsetY = 10 / k;
  }
  ctx.stroke(p);
  ctx.shadowColor = "transparent";
  ctx.fillStyle = STICKER_ORANGE;
  ctx.fill(p);
  ctx.restore();
}

// Deterministyczny szum (ten sam „chwiej" kredy w podgladzie, PNG i kazdej klatce GIF-a -
// losowanie przy kazdym rysowaniu migotaloby w animacji).
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Gwiazdka „kreda": sam obrys, bez wypelnienia. Kilka nalozonych, lekko przesunietych
 * i przerywanych pociagniec o niskim kryciu + miekka biala poswiata - razem daja ziarnisty,
 * nierowny slad jak kreda na tablicy. Biel, bo lezy na zdjeciu i ma byc czytelna na kazdym tle.
 */
export function drawStarChalk(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, rot: number, scale: number, seed: number) {
  const k = size / STAR_VB.w;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.translate(-STAR_VB.w * k / 2, -STAR_VB.h * k / 2);
  ctx.scale(k, k);
  const p = getStarPath();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  // Poswiata pod spodem - miekki „pyl" kredy (slaba: mocniejsza czytala sie jak neon).
  ctx.save();
  ctx.shadowColor = "rgba(255,255,255,0.45)";
  ctx.shadowBlur = 18 / k;
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 14 / k;
  ctx.stroke(p);
  ctx.restore();
  // Kilka CIENKICH, chwiejnych pociagniec zamiast jednej grubej kreski: kazde lekko
  // przesuniete, z innym rytmem przerw - nakladajac sie daja nierowna, przetarta krawedz.
  const passes = 7;
  for (let i = 0; i < passes; i++) {
    const j = seed * 11 + i * 1.7;
    const dx = (noise(j) - 0.5) * 12 / k;
    const dy = (noise(j + 0.5) - 0.5) * 12 / k;
    ctx.save();
    ctx.translate(dx, dy);
    ctx.rotate((noise(j + 0.7) - 0.5) * 0.03);
    ctx.strokeStyle = `rgba(255,255,255,${0.22 + noise(j + 1) * 0.2})`;
    ctx.lineWidth = (3 + noise(j + 2) * 4) / k;
    const a = 18 + noise(j + 3) * 50, b = 4 + noise(j + 4) * 14, c = 8 + noise(j + 5) * 40, d = 2 + noise(j + 6) * 8;
    ctx.setLineDash([a / k, b / k, c / k, d / k]);
    ctx.lineDashOffset = (noise(j + 7) * 140) / k;
    ctx.stroke(p);
    ctx.restore();
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawPill(ctx: CanvasRenderingContext2D, handle: string, right: number, cy: number) {
  ctx.font = pillFont(ctx, handle);
  ctx.textBaseline = "middle";
  const label = `@${handle}`;
  const textW = ctx.measureText(label).width;
  const w = textW + PAD_X * 2;
  const x = right - w;
  const y = cy - PILL_H / 2;
  const r = PILL_H / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.30)";
  ctx.shadowBlur = 16; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 10;
  ctx.fillStyle = "#FFFFFF";
  roundRect(ctx, x - OUTLINE, y - OUTLINE, w + OUTLINE * 2, PILL_H + OUTLINE * 2, r + OUTLINE);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = STICKER_YELLOW;
  roundRect(ctx, x, y, w, PILL_H, r);
  ctx.fill();
  const ty = cy + 6;
  ctx.fillStyle = STICKER_ORANGE;
  ctx.fillText("@", x + PAD_X, ty);
  const atW = ctx.measureText("@").width;
  ctx.fillStyle = STICKER_BROWN;
  ctx.fillText(handle, x + PAD_X + atW, ty);
}

/**
 * Nakladka na CALA relacje 9:16 dla kazdego zestawu - takze „sama nazwa" (pigulka w prawym
 * dolnym rogu, bez gwiazdek). Tego uzywa Stories na wprost i podglad wyboru zestawu: naklejka
 * laduje w edytorze Instagrama DOKLADNIE tam, gdzie w podgladzie. Wariant `pill` z `drawSticker`
 * (plotno przyciete do pigulki) zostaje dla pobierania pliku.
 */
export function drawOverlay(ctx: CanvasRenderingContext2D, handle: string, ph: number, variant: StickerVariant) {
  if (variant === "full") {
    // Uklad z referencji: duza rozowa u gory po prawej, mala zolta pod nia, zielona po lewej
    // u dolu, pigulka w prawym dolnym rogu. Kazda gwiazdka ma inna faze - inaczej wszystkie
    // pulsowalyby naraz i kadr „mrugalby" jak jeden element (ta sama lekcja co przy hero landingu).
    drawStar(ctx, 790, 470, 300, -0.30 + Math.sin(ph) * 0.14, 1 + Math.sin(ph + 0.9) * 0.05, 30, STAR_PINK);
    drawStar(ctx, 890, 690, 130, 0.35 + Math.sin(ph + 2.0) * 0.20, 1 + Math.sin(ph + 2.8) * 0.09, 18, STICKER_YELLOW);
    drawStar(ctx, 225, 1600, 250, 0.18 + Math.sin(ph + 4.1) * 0.14, 1 + Math.sin(ph + 4.9) * 0.06, 26, STAR_GREEN);
  } else if (variant === "chalk") {
    drawStarChalk(ctx, 790, 470, 300, -0.30 + Math.sin(ph) * 0.14, 1 + Math.sin(ph + 0.9) * 0.05, 1);
    drawStarChalk(ctx, 890, 690, 130, 0.35 + Math.sin(ph + 2.0) * 0.20, 1 + Math.sin(ph + 2.8) * 0.09, 2);
    drawStarChalk(ctx, 225, 1600, 250, 0.18 + Math.sin(ph + 4.1) * 0.14, 1 + Math.sin(ph + 4.9) * 0.06, 3);
  } else if (variant === "alt") {
    // Inny uklad: klaster u gory po LEWEJ (zielona duza + zolta mala) i rozowa nad pigulka.
    drawStar(ctx, 250, 430, 290, 0.22 + Math.sin(ph + 1.3) * 0.14, 1 + Math.sin(ph + 0.4) * 0.05, 30, STAR_GREEN);
    drawStar(ctx, 470, 620, 140, -0.40 + Math.sin(ph + 3.1) * 0.20, 1 + Math.sin(ph + 2.2) * 0.09, 18, STICKER_YELLOW);
    drawStar(ctx, 860, 1420, 240, -0.20 + Math.sin(ph + 5.0) * 0.14, 1 + Math.sin(ph + 4.0) * 0.06, 26, STAR_PINK);
  }
  drawPill(ctx, handle, OVERLAY_W - 60, 1690);
}

/** PNG calej relacji (1080 x 1920, przezroczyste tlo) dla Stories - dowolny zestaw, bez animacji. */
export async function overlayPng(handle: string, variant: StickerVariant): Promise<Blob> {
  await ensureStickerFont();
  const canvas = document.createElement("canvas");
  canvas.width = OVERLAY_W; canvas.height = OVERLAY_H;
  const ctx = canvas.getContext("2d")!;
  drawOverlay(ctx, handle, 0, variant);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new Error("toBlob returned null");
  return blob;
}

/**
 * Podglad relacji do wyboru zestawu: zdjecie (kadr cover) albo gradient marki + nakladka,
 * w rozmiarze miniatury. `photo` = juz zaladowany obraz (CORS z naszego Storage) albo null.
 */
export function drawStoryPreview(ctx: CanvasRenderingContext2D, handle: string, variant: StickerVariant, photo: HTMLImageElement | null, w: number, h: number) {
  ctx.save();
  ctx.clearRect(0, 0, w, h);
  if (photo && photo.naturalWidth > 0) {
    const k = Math.max(w / photo.naturalWidth, h / photo.naturalHeight);
    const dw = photo.naturalWidth * k, dh = photo.naturalHeight * k;
    ctx.drawImage(photo, (w - dw) / 2, (h - dh) / 2, dw, dh);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, STICKER_YELLOW); g.addColorStop(1, "#FDCD84");
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  ctx.scale(w / OVERLAY_W, h / OVERLAY_H);
  drawOverlay(ctx, handle, 0, variant);
  ctx.restore();
}
