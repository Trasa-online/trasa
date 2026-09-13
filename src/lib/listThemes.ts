// Tla list miejsc (prosba Nat 2026-09-13, makieta eksploracji): lista na siatce Glownej
// to kolorowy kafelek z mini-siatka miejsc, a autor wybiera kolor tla z ZAMKNIETEJ palety
// marki (nie dowolny kolor - jak przy ramkach awatara chodzi o spojnosc siatki). Wartosc
// zyje w discovery_collections.theme (CHECK w migracji 20260913_list_theme).
//
// `ink` = kolor tekstu na tym tle (tytul, chipy, autor). Ciemne tla dostaja biel, jasne -
// braz marki (#5B2C06, ten sam co na landingu na zoltym).
export type ListThemeId = "brick" | "terracotta" | "peach" | "blush" | "pink" | "yellow" | "gold" | "orange" | "brown";

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
];

export function isListTheme(v: unknown): v is ListThemeId {
  return typeof v === "string" && LIST_THEMES.some((t) => t.id === v);
}

// Lista bez wybranego tla dostaje STALY kolor wyliczony z id (ta sama lista = ten sam kolor
// na kazdym telefonie, przy kazdym otwarciu), z podzbioru "ceglano-rozowego" z makiety -
// siatka jest kolorowa od pierwszego dnia, a autor moze to nadpisac w widoku listy.
const DEFAULT_POOL: ListThemeId[] = ["brick", "terracotta", "peach", "blush", "pink"];

export function listTheme(theme: unknown, id: string): ListTheme {
  if (isListTheme(theme)) return LIST_THEMES.find((t) => t.id === theme)!;
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const pick = DEFAULT_POOL[h % DEFAULT_POOL.length];
  return LIST_THEMES.find((t) => t.id === pick)!;
}
