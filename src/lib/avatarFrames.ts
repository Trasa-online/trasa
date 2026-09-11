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
