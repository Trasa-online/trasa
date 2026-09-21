// KARTA UDOSTEPNIANIA JAKO OBRAZ (prosba Nat 2026-09-21): Instagram i Pinterest nie przyjmuja
// linku - trzeba im dac PLIK. Renderujemy DOM podgladu (dokladnie ten sam kafelek, ktory
// widac w arkuszu) do PNG/JPG, a potem:
//  - natywka: zapis do katalogu cache + systemowy arkusz z plikiem (`Share.share({ files })`),
//    w ktorym stoi Instagram, Pinterest i „Zapisz obraz";
//  - web: `navigator.share` z plikiem, gdy przegladarka umie, inaczej zwykle pobranie.
//
// Do 21.09 ten plik nie istnial celowo (komentarz w ShareCard: „renderowanie DOM-u do PNG
// wymaga biblioteki i CORS-u na wszystkich zdjeciach"). Oba warunki sa dzis spelnione: zdjecia
// ida wylacznie z naszego Storage (`access-control-allow-origin: *`, sprawdzone curl-em z
// originem `capacitor://localhost`), a `modern-screenshot` ma wbudowana poprawke na WebKit
// (kilkukrotne `drawImage`, bez niej pierwszy render w Safari wychodzil bez obrazkow).
//
// ⚠️ Zdjecie spoza naszego Storage (bez CORS) zostawi w kadrze pusta plame - biblioteka nie
// rzuci bledem. Dzis takich zrodel na kartach nie ma (decyzja 2026-09-15: zero Google).
import { createContext, destroyContext, domToCanvas } from "modern-screenshot";
import { isNative } from "@/lib/platform";
import { track } from "@/lib/analytics";

export type ShareImageFormat = "png" | "jpeg";

/** Docelowa szerokosc obrazu w pikselach - Stories i piny Pinteresta maja 1080 px. */
const TARGET_WIDTH = 1080;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/**
 * DOM -> obraz. `background` to tlo wokol karty (zolty marki) - JPG nie ma przezroczystosci,
 * a PNG z zoltym tlem wyglada tak samo jak arkusz, wiec oba formaty dostaja ten sam kadr.
 */
export async function renderShareImage(node: HTMLElement, format: ShareImageFormat, opts?: { background?: string; padding?: number }): Promise<Blob> {
  const padding = opts?.padding ?? 28;
  const background = opts?.background ?? "#FDF184";
  const rect = node.getBoundingClientRect();
  // Kadr = TRESC, nie pudelko: kontener podgladu ma `h-full` (karta planu go wypelnia), ale
  // kafelek kolekcji jest nizszy i pod nim zostawal pas pustego zoltego tla. Bierzemy sume
  // prostokatow potomkow przycieta do kontenera - dziala dla planu (caly), kolekcji (biala
  // oprawa) i miejsca (pudelko 9:16 wysrodkowane w szerszym wrapperze).
  const box = contentBounds(node, rect);
  const width = Math.ceil(box.width);
  const height = Math.ceil(box.height);
  const scale = Math.max(2, Math.min(4, TARGET_WIDTH / (width + padding * 2)));
  const ctx = await createContext(node, {
    scale,
    backgroundColor: background,
    // Kontrolki karty (rozwin, zapisz...) to nie tresc - znaczone `data-share-image-skip`.
    filter: (el) => !(el instanceof HTMLElement && el.dataset.shareImageSkip === "true"),
    // Czcionki z Google Fonts ida przez fetch (fonts.googleapis.com ma CORS); woff2 najmniejszy.
    font: { preferredFormat: "woff2" },
    // Klon dostaje skopiowany `transform` z chwili zrzutu, ale RAZEM z `animation` - w obrazie
    // svg animacja startowala od zera i nakladka awatara (orbita gwiazdek/serc) raz byla,
    // raz nie (dwa rendery po kolei roznily sie). Gasimy animacje w klonie: pozycja zostaje
    // zamrozona na tej z ekranu.
    onCloneEachNode: (cloned) => {
      if (cloned instanceof HTMLElement || cloned instanceof SVGElement) {
        cloned.style.animation = "none";
        cloned.style.transition = "none";
      }
    },
  });
  let card: HTMLCanvasElement;
  try {
    card = await domToCanvas(ctx);
  } finally {
    destroyContext(ctx);
  }
  // Margines zoltego tla dokladamy NA PLOTNIE, nie stylem na klonie: przesuwanie klonu
  // transformem zostawialo czarny pas na gorze i po lewej (biblioteka maluje tlo pod klonem,
  // nie pod calym plotnem - zlapane renderem w WebKit).
  const out = document.createElement("canvas");
  out.width = Math.round((width + padding * 2) * scale);
  out.height = Math.round((height + padding * 2) * scale);
  const c2d = out.getContext("2d");
  if (!c2d) throw new Error("canvas 2d unavailable");
  c2d.fillStyle = background;
  c2d.fillRect(0, 0, out.width, out.height);
  const sx = Math.round((box.left - rect.left) * scale);
  const sy = Math.round((box.top - rect.top) * scale);
  c2d.drawImage(card, sx, sy, Math.round(width * scale), Math.round(height * scale), Math.round(padding * scale), Math.round(padding * scale), Math.round(width * scale), Math.round(height * scale));
  const type = format === "png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, type, 0.92));
  // ⚠️ iOS potrafi oddac PNG zamiast zadanego typu albo null przy braku pamieci - sprawdzamy
  // typ, zeby nazwa pliku zgadzala sie z zawartoscia (patrz memory o toBlob na iOS).
  if (!blob) throw new Error("toBlob returned null");
  return blob.type === type ? blob : new Blob([blob], { type: blob.type || type });
}

/** Czy element cokolwiek MALUJE (tlo, obrys, cien, obraz, tekst). Przezroczyste wrappery
 *  flex/grid nie licza sie do kadru - inaczej wysrodkowane pudelko 9:16 dostawalo z boku pas
 *  pustego tla po szerokosci swojego rodzica. */
function paints(el: Element): boolean {
  const tag = el.tagName;
  if (tag === "IMG" || tag === "SVG" || tag === "CANVAS" || tag === "VIDEO" || tag === "PICTURE") return true;
  const cs = getComputedStyle(el);
  if (cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent") return true;
  if (cs.backgroundImage !== "none" || cs.boxShadow !== "none") return true;
  if (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none") return true;
  if ((cs as any).webkitMaskImage && (cs as any).webkitMaskImage !== "none") return true;
  // Tekst bezposrednio w elemencie (nie w potomkach).
  for (const c of Array.from(el.childNodes)) if (c.nodeType === Node.TEXT_NODE && c.textContent?.trim()) return true;
  return false;
}

function contentBounds(node: HTMLElement, rect: DOMRect): { left: number; top: number; width: number; height: number } {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const el of Array.from(node.querySelectorAll<HTMLElement>("*"))) {
    if (el.dataset.shareImageSkip === "true" || el.closest("[data-share-image-skip='true']")) continue;
    if (!paints(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) continue;
    left = Math.min(left, r.left); top = Math.min(top, r.top);
    right = Math.max(right, r.right); bottom = Math.max(bottom, r.bottom);
  }
  if (!Number.isFinite(left)) return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  left = Math.max(left, rect.left); top = Math.max(top, rect.top);
  right = Math.min(right, rect.right); bottom = Math.min(bottom, rect.bottom);
  return { left, top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}

export type DeliverResult = "shared" | "downloaded" | "cancelled" | "failed";

/**
 * Oddaje gotowy obraz uzytkownikowi. Natywka: systemowy arkusz z PLIKIEM (tam Instagram,
 * Pinterest, „Zapisz obraz"). Web: arkusz z plikiem albo pobranie.
 */
export async function deliverShareImage(blob: Blob, filename: string, opts?: { title?: string; kind?: string; channel?: string }): Promise<DeliverResult> {
  track("content_shared_image", { kind: opts?.kind ?? "unknown", channel: opts?.channel ?? "download", format: blob.type });
  if (isNative) {
    try {
      const [{ Filesystem, Directory }, { Share }] = await Promise.all([import("@capacitor/filesystem"), import("@capacitor/share")]);
      const data = await blobToBase64(blob);
      const written = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
      await Share.share({ title: opts?.title, files: [written.uri] });
      return "shared";
    } catch (e) {
      const msg = String((e as any)?.message ?? "").toLowerCase();
      if (msg.includes("cancel")) return "cancelled";
      console.warn("[shareImage] native share:", (e as any)?.message ?? e);
      return "failed";
    }
  }
  const file = new File([blob], filename, { type: blob.type });
  if (typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: opts?.title });
      return "shared";
    } catch (e) {
      if ((e as any)?.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}

/** Bezpieczna nazwa pliku z tytulu: `spontaway-majowka-2025.png`. */
export function shareImageFilename(title: string, format: ShareImageFormat): string {
  const slug = title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "karta";
  return `spontaway-${slug}.${format === "png" ? "png" : "jpg"}`;
}
