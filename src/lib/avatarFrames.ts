// Ramki / nakladki na awatar (2026-09-11). Lista dostepnych wariantow = jedno zrodlo prawdy
// dla arkusza wyboru w ustawieniach i dla renderu. Wartosc w profiles.avatar_frame
// (CHECK w migracji 20260911f) musi sie zgadzac z tymi id.
export type AvatarFrameId = "stars" | "hearts" | "clouds" | "moon" | "moonstars" | "banana" | "rainbow";

// `reward`: nakladka-NAGRODA - zablokowana, dopoki user nie zaprosi REFERRAL_GOAL osob
// (albo nie dostanie grantu). Blokade egzekwuje baza (trigger guard_avatar_frame, migracja
// 20260911h); UI tylko ja pokazuje. Stan odblokowania: RPC my_frame_unlocks().
//
// `fixedColor`: nakladka ma WLASNE kolory i ignoruje wybor z pipety. Banan musi byc zolty,
// a tecza tecza - przemalowanie ich na granat nie mialoby sensu. Arkusz chowa wtedy caly
// wybor koloru, zeby nie obiecywac czegos, co nie zadziala.
//
// ⛔ DODAJESZ NAKLADKE - trzy miejsca w BAZIE, nie jedno: (1) CHECK `profiles_avatar_frame_check`,
// (2) funkcja `frame_unlocked` (zwraca FALSE dla wszystkiego spoza swojej listy, wiec bez
// dopisania trigger `guard_avatar_frame` odrzuci zapis bledem `frame_locked`), (3) etykiety
// `frames.<id>` w settings.json PL i EN. Do tego glif w AvatarFrame.tsx. Migracja 20260916d.
// `gift`: nakladka, ktorej NIE DA SIE zdobyc - odblokowuje wylacznie wpis w `frame_grants`
// (migracje 20260916e i 20260916g). ⛔ Lista prezentow zyje w DWOCH miejscach i musza sie
// zgadzac: tutaj (`gift: true`) oraz w SQL - `frame_unlocked` i `my_frame_gift`. Arkusz CHOWA ja przed wszystkimi, ktorzy jej nie dostali: klodka bez
// zadnej drogi do odblokowania to sama frustracja. Tym rozni sie od `reward` (tecza), ktora
// stoi na liscie od poczatku z postepem "0 z 3", bo jest do zdobycia.
export const AVATAR_FRAMES: { id: AvatarFrameId; labelKey: string; reward?: boolean; gift?: boolean; fixedColor?: boolean }[] = [
  { id: "stars",     labelKey: "frames.stars" },
  { id: "hearts",    labelKey: "frames.hearts" },
  { id: "clouds",    labelKey: "frames.clouds" },
  { id: "moon",      labelKey: "frames.moon" },
  { id: "moonstars", labelKey: "frames.moonstars", gift: true },
  { id: "banana",    labelKey: "frames.banana", gift: true, fixedColor: true },
  { id: "rainbow",   labelKey: "frames.rainbow", reward: true, fixedColor: true },
];

// Zbior liczony Z LISTY, a nie przepisany recznie - straznik typu nie moze sie rozjechac
// z tym, co widac w arkuszu (wczesniej byl tu lancuch `v === "stars" || ...`).
const FRAME_IDS = new Set<string>(AVATAR_FRAMES.map((f) => f.id));

export function isAvatarFrame(v: unknown): v is AvatarFrameId {
  return typeof v === "string" && FRAME_IDS.has(v);
}

/** Czy nakladka rysuje sie WLASNYMI kolorami (pipeta jej nie dotyczy). */
export function frameHasFixedColor(id: AvatarFrameId | null | undefined): boolean {
  return !!AVATAR_FRAMES.find((f) => f.id === id)?.fixedColor;
}

/** Domyslny kolor KAZDEJ nakladki = pomarancz marki (decyzja Nat 2026-09-11). */
export const DEFAULT_FRAME_COLOR = "#EE5307";

/** Szybkie kolory w arkuszu (pierwszy = domyslny). Dowolny inny user wybiera z palety systemowej. */
export const FRAME_SWATCHES = [DEFAULT_FRAME_COLOR, "#FDCD84", "#E63B7A", "#D62828", "#2F6FED", "#1F9D55", "#7C3AED", "#0E0E0E"];

export function isFrameColor(v: unknown): v is string {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
}
