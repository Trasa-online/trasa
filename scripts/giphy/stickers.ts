// NAKLEJKI NA GIPHY (prosba Nat 2026-09-21): piec animowanych GIF-ow z przezroczystym tlem
// pod kanal marki spontaway (GIPHY wymaga min. 5 GIF-ow, zeby rozpatrzyc wniosek o Brand
// Channel). Po zatwierdzeniu kanalu ruchome gwiazdki sa w tacce naklejek Instagram Stories,
// TikToka i WhatsApp Status pod haslem „spontaway" - jedyna droga do RUCHOMEJ naklejki, ktora
// user moze przesuwac (Instagram nie przyjmuje wlasnych GIF-ow z przezroczystoscia).
//
// Uruchomienie: modul jest wolany z Playwrighta (scratchpad `giphy.mjs`) w WebKit przez vite dev
// (`import("/scripts/giphy/stickers.ts")`), bo rysuje na canvasie tym samym kodem, co nakladka
// w apce (`drawStar` / `drawStarChalk` z placeSticker.ts) i znakiem z `spontawayMarkPaths.ts`.
import { GIFEncoder, quantize, applyPalette } from "gifenc";
import { drawStar, drawStarChalk, STAR_PINK, STAR_GREEN, STICKER_YELLOW, STICKER_ORANGE } from "@/lib/placeSticker";
import { MARK_W, MARK_H, MARK_S_PATH, MARK_STAR_PATH, MARK_STAR_BOX } from "@/components/spontawayMarkPaths";

type Draw = (ctx: CanvasRenderingContext2D, t: number) => void; // t w [0, 1)

async function encodeGif(draw: Draw, w: number, h: number, frames: number, delay: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const gif = GIFEncoder();
  // Paleta z klatki t = 0,8, NIE z pierwszej: w „rysowanym S" pierwsza klatka jest PUSTA
  // (przeslona na zerze) i paleta z niej mialaby sam kolor przezroczysty - caly GIF wychodzil
  // pusty. Przy 0,8 widac juz wszystko, co ma sie pojawic (S + gwiazdka).
  ctx.clearRect(0, 0, w, h);
  draw(ctx, 0.8);
  const palette = quantize(ctx.getImageData(0, 0, w, h).data, 255, { format: "rgba4444", oneBitAlpha: true });
  let transparentIndex = palette.findIndex((c) => c.length > 3 && c[3] === 0);
  if (transparentIndex < 0) { palette.push([0, 0, 0, 0]); transparentIndex = palette.length - 1; }
  for (let i = 0; i < frames; i++) {
    ctx.clearRect(0, 0, w, h);
    draw(ctx, i / frames);
    const data = ctx.getImageData(0, 0, w, h).data;
    const index = applyPalette(data, palette, "rgba4444");
    for (let p = 0, q = 3; p < index.length; p++, q += 4) if (data[q] <= 127) index[p] = transparentIndex;
    gif.writeFrame(index, w, h, { palette: i === 0 ? palette : undefined, delay, repeat: 0, transparent: true, transparentIndex, dispose: 2 });
    if (i % 8 === 7) await new Promise((r) => setTimeout(r, 0));
  }
  gif.finish();
  return new Blob([gif.bytes()], { type: "image/gif" });
}

const TAU = Math.PI * 2;

// 1. Gwiazdki-naklejki, zwarty klaster (jak na relacji z referencji).
const starsCluster: Draw = (ctx, t) => {
  const ph = t * TAU;
  drawStar(ctx, 300, 270, 300, -0.30 + Math.sin(ph) * 0.14, 1 + Math.sin(ph + 0.9) * 0.05, 30, STAR_PINK);
  drawStar(ctx, 530, 420, 140, 0.35 + Math.sin(ph + 2.0) * 0.20, 1 + Math.sin(ph + 2.8) * 0.09, 18, STICKER_YELLOW);
  drawStar(ctx, 400, 560, 250, 0.18 + Math.sin(ph + 4.1) * 0.14, 1 + Math.sin(ph + 4.9) * 0.06, 26, STAR_GREEN);
};

// 2. Ten sam zestaw w innym ukladzie: po przekatnej, od malej do duzej.
const starsDiagonal: Draw = (ctx, t) => {
  const ph = t * TAU;
  drawStar(ctx, 170, 170, 150, 0.40 + Math.sin(ph + 1.1) * 0.18, 1 + Math.sin(ph + 0.3) * 0.08, 18, STICKER_YELLOW);
  drawStar(ctx, 360, 360, 230, -0.15 + Math.sin(ph + 2.6) * 0.14, 1 + Math.sin(ph + 1.9) * 0.06, 26, STAR_GREEN);
  drawStar(ctx, 560, 560, 300, 0.22 + Math.sin(ph + 4.4) * 0.12, 1 + Math.sin(ph + 3.7) * 0.05, 30, STAR_PINK);
};

// 3. Gwiazdki pisane kreda (sam obrys), klaster jak w 1.
const starsChalk: Draw = (ctx, t) => {
  const ph = t * TAU;
  drawStarChalk(ctx, 300, 270, 300, -0.30 + Math.sin(ph) * 0.14, 1 + Math.sin(ph + 0.9) * 0.05, 1);
  drawStarChalk(ctx, 530, 420, 140, 0.35 + Math.sin(ph + 2.0) * 0.20, 1 + Math.sin(ph + 2.8) * 0.09, 2);
  drawStarChalk(ctx, 400, 560, 250, 0.18 + Math.sin(ph + 4.1) * 0.14, 1 + Math.sin(ph + 4.9) * 0.06, 3);
};

// Znak: wspolrzedne z logo (618 x 636) skalowane do plotna z marginesem.
let sPath: Path2D | null = null, starPath: Path2D | null = null;
const markPaths = () => ({ s: (sPath ??= new Path2D(MARK_S_PATH)), star: (starPath ??= new Path2D(MARK_STAR_PATH)) });
const MARK_PAD = 60;
function withMark(ctx: CanvasRenderingContext2D, w: number, h: number, fn: (k: number) => void) {
  const k = Math.min((w - MARK_PAD * 2) / MARK_W, (h - MARK_PAD * 2) / MARK_H);
  ctx.save();
  ctx.translate((w - MARK_W * k) / 2, (h - MARK_H * k) / 2);
  ctx.scale(k, k);
  fn(k);
  ctx.restore();
}
const starCenter = { x: MARK_STAR_BOX.x + MARK_STAR_BOX.w / 2, y: MARK_STAR_BOX.y + MARK_STAR_BOX.h / 2 };
function drawMarkStar(ctx: CanvasRenderingContext2D, scale: number, rot: number) {
  const { star } = markPaths();
  ctx.save();
  ctx.translate(starCenter.x, starCenter.y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.translate(-starCenter.x, -starCenter.y);
  ctx.fillStyle = STICKER_ORANGE;
  ctx.fill(star);
  ctx.restore();
}

// 4. Logo „S" z PULSUJACA gwiazdka (sama skala - zero krycia, jak na splashu).
const markPulse = (w: number, h: number): Draw => (ctx, t) =>
  withMark(ctx, w, h, () => {
    const { s } = markPaths();
    ctx.fillStyle = STICKER_ORANGE;
    ctx.fill(s);
    const ph = t * TAU;
    drawMarkStar(ctx, 1 + Math.sin(ph) * 0.11, Math.sin(ph + 1.2) * 0.08);
  });

// 5. „S" RYSUJE SIE od lewej (przeslona jak w SplashDraw), na koncu gwiazdka STEMPLUJE sie
//    z przestrzeleniem skali (keyframes `splash-star-pop`), potem chwila spokoju i od nowa.
const easeInOut = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
function popAt(u: number): { s: number; r: number } {
  // u w [0,1] = postep stempla; punkty z `splash-star-pop`.
  const kf = [[0, 0.3, -40], [0.18, 0.72, -18], [0.6, 1.14, 7], [0.82, 0.96, -2], [1, 1, 0]];
  for (let i = 1; i < kf.length; i++) {
    if (u <= kf[i][0]) {
      const [t0, s0, r0] = kf[i - 1], [t1, s1, r1] = kf[i];
      const f = (u - t0) / (t1 - t0);
      return { s: s0 + (s1 - s0) * f, r: (r0 + (r1 - r0) * f) * Math.PI / 180 };
    }
  }
  return { s: 1, r: 0 };
}
const markDraw = (w: number, h: number): Draw => (ctx, t) =>
  withMark(ctx, w, h, () => {
    const { s } = markPaths();
    const DRAW_END = 0.42, POP_START = 0.46, POP_END = 0.64;
    ctx.fillStyle = STICKER_ORANGE;
    if (t < DRAW_END) {
      const p = easeInOut(t / DRAW_END);
      ctx.save();
      ctx.beginPath();
      ctx.rect(-10, -10, (MARK_W + 20) * p, MARK_H + 20);
      ctx.clip();
      ctx.fill(s);
      ctx.restore();
      return;
    }
    ctx.fill(s);
    if (t < POP_START) return;
    if (t < POP_END) {
      const { s: sc, r } = popAt((t - POP_START) / (POP_END - POP_START));
      drawMarkStar(ctx, sc, r);
      return;
    }
    // Spokoj: plytki oddech gwiazdki do konca petli.
    const ph = ((t - POP_END) / (1 - POP_END)) * TAU;
    drawMarkStar(ctx, 1 + Math.sin(ph) * 0.03, 0);
  });

export type Sticker = { name: string; blob: Blob; w: number; h: number };

export async function renderAll(): Promise<Sticker[]> {
  try { await document.fonts.load("400 96px Sigmar"); } catch { /* bez znaczenia - tu nie ma tekstu */ }
  const out: Sticker[] = [];
  const add = async (name: string, draw: Draw, w: number, h: number, frames = 40, delay = 50) => {
    out.push({ name, blob: await encodeGif(draw, w, h, frames, delay), w, h });
  };
  await add("1-gwiazdki-naklejki", starsCluster, 720, 720);
  await add("2-gwiazdki-inny-uklad", starsDiagonal, 720, 720);
  await add("3-gwiazdki-kreda", starsChalk, 720, 720);
  await add("4-logo-s-pulsujaca-gwiazdka", markPulse(720, 740), 720, 740);
  await add("5-logo-s-rysowane-stempel", markDraw(720, 740), 720, 740, 72, 50);
  return out;
}
