// Ramki / nakladki na awatar (2026-09-11). Lista dostepnych wariantow = jedno zrodlo prawdy
// dla arkusza wyboru w ustawieniach i dla renderu. Wartosc w profiles.avatar_frame
// (CHECK w migracji 20260911f) musi sie zgadzac z tymi id.
export type AvatarFrameId = "stars" | "hearts" | "clouds";

export const AVATAR_FRAMES: { id: AvatarFrameId; labelKey: string }[] = [
  { id: "stars",  labelKey: "frames.stars" },
  { id: "hearts", labelKey: "frames.hearts" },
  { id: "clouds", labelKey: "frames.clouds" },
];

export function isAvatarFrame(v: unknown): v is AvatarFrameId {
  return v === "stars" || v === "hearts" || v === "clouds";
}

/** Domyslny kolor KAZDEJ nakladki = pomarancz marki (decyzja Nat 2026-09-11). */
export const DEFAULT_FRAME_COLOR = "#EE5307";

/** Szybkie kolory w arkuszu (pierwszy = domyslny). Dowolny inny user wybiera z palety systemowej. */
export const FRAME_SWATCHES = [DEFAULT_FRAME_COLOR, "#FDCD84", "#E63B7A", "#D62828", "#2F6FED", "#1F9D55", "#7C3AED", "#0E0E0E"];

export function isFrameColor(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}
