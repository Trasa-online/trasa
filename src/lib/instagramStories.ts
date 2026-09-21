// INSTAGRAM STORIES „NA WPROST" (prosba Nat 2026-09-21): kafelek „Instagram" w arkuszu
// udostepniania otwiera EDYTOR RELACJI z nasza nakladka juz nalozona, a link do tresci laduje
// w schowku - w Stories user tapa naklejke „Link" i wkleja. To jedyna droga do klikalnego
// linku w relacji: Instagram nie przyjmuje linku razem z obrazem (dokumentacja Meta „Sharing to
// Stories" zna wylacznie obraz tla, obraz naklejki i dwa kolory; `contentURL` wycofany).
//
// Most natywny: ios/App/App/InstagramStoriesPlugin.swift (schowek + `instagram-stories://share`).
// Wymaga Facebook App ID w `VITE_FACEBOOK_APP_ID` - bez niego (albo bez Instagrama na telefonie,
// albo na webie) `shareToInstagramStories` oddaje "unavailable" i arkusz wraca do systemowego
// udostepniania pliku, jak do tej pory.
import { registerPlugin } from "@capacitor/core";
import { isNative } from "@/lib/platform";

// Facebook App ID apki „spontaway" (Meta for Developers, konto Nat, 2026-09-21). To identyfikator
// PUBLICZNY (Instagram i tak dostaje go w adresie przy kazdym udostepnieniu), wiec siedzi w kodzie -
// build z dowolnej maszyny ma go miec bez `.env`. `VITE_FACEBOOK_APP_ID` nadpisuje (np. inna apka testowa).
const DEFAULT_FACEBOOK_APP_ID = "1405978694380412";
export const FACEBOOK_APP_ID = String(import.meta.env.VITE_FACEBOOK_APP_ID ?? "").trim() || DEFAULT_FACEBOOK_APP_ID;

type StoriesPlugin = {
  canShare(): Promise<{ available: boolean }>;
  copy(o: { text: string }): Promise<void>;
  share(o: { appId: string; stickerImage?: string; backgroundImage?: string; backgroundTopColor?: string; backgroundBottomColor?: string; link?: string }): Promise<{ opened: boolean; reason?: string }>;
};

let plugin: StoriesPlugin | null = null;
function getPlugin(): StoriesPlugin {
  return (plugin ??= registerPlugin<StoriesPlugin>("InstagramStories"));
}

/** Czy da sie otworzyc Stories na wprost: natywka + App ID + zainstalowany Instagram. */
export async function canShareToStories(): Promise<boolean> {
  if (!isNative || !FACEBOOK_APP_ID) return false;
  try { return (await getPlugin().canShare()).available; } catch { return false; }
}

/**
 * Link do schowka. Natywka: przez plugin (`UIPasteboard`, dziala takze po `await`); web:
 * `navigator.clipboard` - WYLACZNIE w gescie usera, wiec wolaj to PRZED pierwszym `await`.
 */
export async function copyLinkToClipboard(text: string): Promise<boolean> {
  if (isNative) {
    try { await getPlugin().copy({ text }); return true; } catch { /* stary build bez pluginu */ }
  }
  try { await navigator.clipboard?.writeText(text); return true; } catch { return false; }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(r.error);
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.readAsDataURL(blob);
  });
}

export type StoriesResult = "opened" | "unavailable" | "failed";

export async function shareToInstagramStories(o: {
  sticker?: Blob;
  background?: Blob | null;
  /** Kolory tla, gdy nie ma obrazu tla (gradient gora -> dol). */
  topColor?: string;
  bottomColor?: string;
  link?: string;
}): Promise<StoriesResult> {
  if (!(await canShareToStories())) return "unavailable";
  try {
    const [stickerImage, backgroundImage] = await Promise.all([
      o.sticker ? blobToBase64(o.sticker) : Promise.resolve(undefined),
      o.background ? blobToBase64(o.background) : Promise.resolve(undefined),
    ]);
    const res = await getPlugin().share({
      appId: FACEBOOK_APP_ID,
      stickerImage,
      backgroundImage,
      backgroundTopColor: backgroundImage ? undefined : (o.topColor ?? "#FDF184"),
      backgroundBottomColor: backgroundImage ? undefined : (o.bottomColor ?? "#FDCD84"),
      link: o.link,
    });
    if (res.opened) return "opened";
    return res.reason === "unavailable" ? "unavailable" : "failed";
  } catch (e) {
    console.warn("[instagramStories]", (e as any)?.message ?? e);
    return "failed";
  }
}

/**
 * Tlo relacji z ZDJECIA: kadr `cover` do 1080 x 1920 (JPG). Zdjecie musi isc z naszego
 * Storage (CORS) - inaczej canvas jest „skazony" i `toBlob` rzuca; wtedy oddajemy null
 * i relacja dostaje sam gradient marki.
 */
export async function storyBackgroundFromPhoto(src: string): Promise<Blob | null> {
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.crossOrigin = "anonymous";
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("image load failed"));
      i.src = src;
    });
    const W = 1080, H = 1920;
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const k = Math.max(W / img.naturalWidth, H / img.naturalHeight);
    const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    return await new Promise<Blob | null>((res) => c.toBlob(res, "image/jpeg", 0.9));
  } catch (e) {
    console.warn("[instagramStories] background:", (e as any)?.message ?? e);
    return null;
  }
}
