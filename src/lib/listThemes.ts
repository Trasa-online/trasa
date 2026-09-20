// Tla list miejsc (prosba Nat 2026-09-13, makieta eksploracji): lista na siatce Glownej
// to kolorowy kafelek z mini-siatka miejsc, a autor wybiera kolor tla z ZAMKNIETEJ palety
// marki (nie dowolny kolor - jak przy ramkach awatara chodzi o spojnosc siatki). Wartosc
// zyje w discovery_collections.theme (CHECK w migracji 20260913_list_theme).
//
// `ink` = kolor tekstu na tym tle (tytul, chipy, autor). Ciemne tla dostaja biel, jasne -
// braz marki (#5B2C06, ten sam co na landingu na zoltym).
export type ListThemeId =
  | "brick" | "terracotta" | "peach" | "blush" | "pink" | "yellow" | "gold" | "orange" | "brown"
  | "cream" | "sand" | "sage" | "moss" | "teal" | "sky" | "denim" | "plum" | "wine";

/** `labelKey` w przestrzeni `routelist` (theme.*). */
export type ListTheme = { id: ListThemeId; labelKey: string; bg: string; ink: string };

export const LIST_THEMES: ListTheme[] = [
  { id: "brick",      labelKey: "theme.brick",      bg: "#A6402A", ink: "#FFFFFF" },
  { id: "terracotta", labelKey: "theme.terracotta", bg: "#C8836E", ink: "#FFFFFF" },
  { id: "peach",      labelKey: "theme.peach",      bg: "#E9A58D", ink: "#FFFFFF" },
  { id: "blush",      labelKey: "theme.blush",      bg: "#E8A99C", ink: "#FFFFFF" },
  { id: "pink",       labelKey: "theme.pink",       bg: "#F3B7C0", ink: "#5B2C06" },
  { id: "yellow",     labelKey: "theme.yellow",     bg: "#FDF184", ink: "#5B2C06" },
  { id: "gold",       labelKey: "theme.gold",       bg: "#FDCD84", ink: "#5B2C06" },
  { id: "orange",     labelKey: "theme.orange",     bg: "#EE5307", ink: "#FFFFFF" },
  { id: "brown",      labelKey: "theme.brown",      bg: "#5B2C06", ink: "#FFFFFF" },
  // Rozszerzenie 2026-09-15 (prosba Nat): dziewiec kolorow zaczelo sie powtarzac miedzy
  // kolekcjami tego samego autora. Cieply rdzen marki zostaje na poczatku listy, dalej ida
  // tony chlodniejsze - kolekcje maja byc od siebie ROZROZNIALNE, a nie wszystkie pomaranczowe.
  { id: "cream",      labelKey: "theme.cream",      bg: "#F7E8D0", ink: "#5B2C06" },
  { id: "sand",       labelKey: "theme.sand",       bg: "#E3C9A0", ink: "#5B2C06" },
  { id: "sage",       labelKey: "theme.sage",       bg: "#AEC3A4", ink: "#5B2C06" },
  { id: "moss",       labelKey: "theme.moss",       bg: "#5E7A55", ink: "#FFFFFF" },
  { id: "teal",       labelKey: "theme.teal",       bg: "#2F6F6B", ink: "#FFFFFF" },
  { id: "sky",        labelKey: "theme.sky",        bg: "#A9CBE3", ink: "#5B2C06" },
  { id: "denim",      labelKey: "theme.denim",      bg: "#3E5C76", ink: "#FFFFFF" },
  { id: "plum",       labelKey: "theme.plum",       bg: "#6B4266", ink: "#FFFFFF" },
  { id: "wine",       labelKey: "theme.wine",       bg: "#7E2F41", ink: "#FFFFFF" },
];

/** Kolor wlasny z pipety zapisujemy jako `#RRGGBB` (CHECK w migracji 20260915). */
export const HEX_RE = /^#[0-9A-Fa-f]{6}$/;
export function isHexTheme(v: unknown): v is string {
  return typeof v === "string" && HEX_RE.test(v);
}

/**
 * Kolor tekstu dla DOWOLNEGO tla - liczony z luminancji wzglednej (WCAG), nie zapisywany
 * w bazie. Dzieki temu zaden kolor z pipety nie moze wyprodukowac nieczytelnego kafelka:
 * jasne tlo dostaje braz marki (#5B2C06), ciemne - biel. Prog 0.5 wychodzi z porownania
 * kontrastu obu kandydatow, wiec przelacza sie dokladnie tam, gdzie biel zaczyna wygrywac.
 */
export function inkFor(bg: string): string {
  const hex = bg.replace("#", "");
  const ch = (i: number) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * ch(0) + 0.7152 * ch(2) + 0.0722 * ch(4);
  return lum > 0.5 ? "#5B2C06" : "#FFFFFF";
}

/** Motyw z koloru wlasnego (pipeta) - `id` niesie sam hex, zeby porownania dzialaly jak dla presetow. */
export function customListTheme(hex: string): ListTheme {
  return { id: hex as ListThemeId, labelKey: "theme.custom", bg: hex, ink: inkFor(hex) };
}

export function isListTheme(v: unknown): v is ListThemeId {
  return typeof v === "string" && LIST_THEMES.some((t) => t.id === v);
}

// Lista bez wybranego tla dostaje STALY kolor wyliczony z id (ta sama lista = ten sam kolor
// na kazdym telefonie, przy kazdym otwarciu), z podzbioru "ceglano-rozowego" z makiety -
// siatka jest kolorowa od pierwszego dnia, a autor moze to nadpisac w widoku listy.
const DEFAULT_POOL: ListThemeId[] = ["brick", "terracotta", "peach", "blush", "pink"];

/**
 * LOSOWY kolor dla NOWEJ kolekcji (prosba Nat 2026-09-14). Do tej pory `theme` zostawal NULL,
 * a kolor byl tylko WYLICZANY z id przy renderze - wiec kolekcja nie miala wlasnego koloru
 * w bazie i belka/kafelek nie mialy z czego go wziac bez powtarzania tej samej logiki.
 *
 * Losujemy z CIEPLEGO RDZENIA marki (pierwsze 9 kolorow), nie z calej palety: swiezo
 * utworzona kolekcja ma wygladac brandowo, a nie wylosowac sobie granat albo sliwke.
 * Chlodne tony z rozszerzenia 2026-09-15 sa do SWIADOMEGO wyboru autora.
 */
const RANDOM_POOL: ListThemeId[] = ["brick", "terracotta", "peach", "blush", "pink", "yellow", "gold", "orange", "brown"];

export function randomListTheme(): ListThemeId {
  return RANDOM_POOL[Math.floor(Math.random() * RANDOM_POOL.length)];
}

export function listTheme(theme: unknown, id: string): ListTheme {
  if (isListTheme(theme)) return LIST_THEMES.find((t) => t.id === theme)!;
  if (isHexTheme(theme)) return customListTheme(theme);
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const pick = DEFAULT_POOL[h % DEFAULT_POOL.length];
  return LIST_THEMES.find((t) => t.id === pick)!;
}
