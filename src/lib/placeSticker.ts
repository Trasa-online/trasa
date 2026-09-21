// NAKLADKA MIEJSCA NA STORIES (prosba Nat 2026-09-21): kompozycja wlepek na cala relacje 9:16 -
// gwiazdki z kolorowymi obwodkami + zolta pigulka „@handle" - do pobrania z arkusza
// udostepniania wizytowki jako:
//  - PNG z przezroczystym tlem (statyczna),
//  - GIF z przezroczystym tlem (gwiazdki delikatnie sie obracaja i pulsuja, handle stoi).
//
// Rysujemy na CANVAS-ie, nie z DOM-u (jak `shareImage.ts`): klatki animacji musza powstawac
// szybko (36 klatek GIF-a), a modern-screenshot renderuje jedna klatke w ~300 ms. Ten sam
// `drawSticker(ctx, t)` maluje podglad na zywo w arkuszu (rAF), PNG (t = 0) i klatki GIF-a -
// wiec to, co user widzi, jest co do piksela tym, co pobiera.
//
// Font: Sigmar (font-brand) - `document.fonts.load` PRZED pierwszym rysowaniem, inaczej canvas
// bierze zapasowy krój i nakladka wyglada inaczej niz w podgladzie.
import { GIFEncoder, quantize, applyPalette } from "gifenc";
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

/** Handle na nakladce: instagram lokalu, a gdy go nie ma - nazwa miejsca bez spacji i znakow. */
export function stickerHandle(place: { place_name?: string | null; businessInstagram?: string | null }): string {
  const ig = (place.businessInstagram ?? "").trim().replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "");
  if (ig) return ig.toLowerCase().slice(0, 30);
  const slug = (place.place_name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return (slug || "spontaway").slice(0, 30);
}

export async function ensureStickerFont(): Promise<void> {
  try { await document.fonts.load(`400 ${FONT_PX}px Sigmar`); } catch { /* zapasowy kroj */ }
}

const FONT = `400 ${FONT_PX}px Sigmar, "Baloo 2", system-ui, sans-serif`;

export function stickerSize(_handle: string): { w: number; h: number } {
  return { w: OVERLAY_W, h: OVERLAY_H };
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, rot: number, scale: number, outline: number, outlineColor: string, shadow = true) {
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
  ctx.font = FONT;
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
 * Jedna klatka calej nakladki 9:16. `t` w [0, 1) = faza animacji (0 = pozycja spoczynkowa,
 * identyczna z PNG). Rysuje w jednostkach logicznych 1080 x 1920 - skalowanie robi wolajacy.
 */
export function drawSticker(ctx: CanvasRenderingContext2D, handle: string, t: number, opts?: { animated?: boolean }) {
  const anim = opts?.animated !== false;
  const ph = anim ? t * Math.PI * 2 : 0;
  ctx.clearRect(0, 0, OVERLAY_W, OVERLAY_H);
  // Uklad z referencji: duza rozowa u gory po prawej, mala zolta pod nia, zielona po lewej
  // u dolu, pigulka w prawym dolnym rogu. Kazda gwiazdka ma inna faze - inaczej wszystkie
  // pulsowalyby naraz i kadr „mrugalby" jak jeden element (ta sama lekcja co przy hero landingu).
  drawStar(ctx, 790, 470, 300, -0.30 + Math.sin(ph) * 0.14, 1 + Math.sin(ph + 0.9) * 0.05, 30, STAR_PINK);
  drawStar(ctx, 890, 690, 130, 0.35 + Math.sin(ph + 2.0) * 0.20, 1 + Math.sin(ph + 2.8) * 0.09, 18, STICKER_YELLOW);
  drawStar(ctx, 225, 1600, 250, 0.18 + Math.sin(ph + 4.1) * 0.14, 1 + Math.sin(ph + 4.9) * 0.06, 26, STAR_GREEN);
  drawPill(ctx, handle, OVERLAY_W - 60, 1690);
}

function makeCanvas(handle: string, scale: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number } {
  const { w, h } = stickerSize(handle);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);
  return { canvas, ctx, w, h };
}

/** PNG z przezroczystym tlem, 1080 x 1920 (pelna relacja). */
export async function stickerPng(handle: string): Promise<Blob> {
  await ensureStickerFont();
  const { canvas, ctx } = makeCanvas(handle, 1);
  drawSticker(ctx, handle, 0, { animated: false });
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
  if (!blob) throw new Error("toBlob returned null");
  return blob;
}

/**
 * GIF z 1-bitowa przezroczystoscia: 36 klatek co 50 ms (1,8 s petli). Paleta liczona RAZ
 * z klatki srodkowej (kolory sa stale), kazda klatka `dispose: 2` (czysci tlo), inaczej
 * poprzednie pozycje gwiazdek zostawalyby pod spodem.
 */
export async function stickerGif(handle: string, opts?: { frames?: number; delayMs?: number; onProgress?: (done: number, total: number) => void }): Promise<Blob> {
  await ensureStickerFont();
  const frames = opts?.frames ?? 30;
  const delay = opts?.delayMs ?? 60;
  // GIF: 540 x 960 (polowa relacji) - 36 klatek w pelnej rozdzielczosci to ~70 MB surowych
  // pikseli do kwantyzacji i kilkanascie sekund na telefonie; Instagram i tak przeskalowuje.
  const { canvas, ctx } = makeCanvas(handle, 0.5);
  const W = canvas.width, H = canvas.height;
  const gif = GIFEncoder();
  let palette: number[][] | null = null;
  let transparentIndex = 0;
  for (let i = 0; i < frames; i++) {
    drawSticker(ctx, handle, i / frames, { animated: true });
    const data = ctx.getImageData(0, 0, W, H).data;
    if (!palette) {
      palette = quantize(data, 255, { format: "rgba4444", oneBitAlpha: true });
      // Kolor przezroczysty = wpis palety z alfa 0 (albo doklejony, gdy kwantyzacja go nie dala).
      let idx = palette.findIndex((c) => c.length > 3 && c[3] === 0);
      if (idx < 0) { palette.push([0, 0, 0, 0]); idx = palette.length - 1; }
      transparentIndex = idx;
    }
    const index = applyPalette(data, palette, "rgba4444");
    // Piksele o alfie <= 127 ida na indeks przezroczysty (kwantyzacja rgba4444 nie gwarantuje
    // mapowania kazdego takiego piksela na wpis z alfa 0).
    for (let p = 0, q = 3; p < index.length; p++, q += 4) if (data[q] <= 127) index[p] = transparentIndex;
    gif.writeFrame(index, W, H, { palette: i === 0 ? palette : undefined, delay, repeat: 0, transparent: true, transparentIndex, dispose: 2 });
    opts?.onProgress?.(i + 1, frames);
    if (i % 6 === 5) await new Promise((r) => setTimeout(r, 0)); // oddech dla UI
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}
