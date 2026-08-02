import { categoryIconSrc } from "@/lib/placeCategoryIcon";

// Reuzycie autentycznych ikon kategorii z apki (/public/Ikona__*.svg, #ef9d78
// na tle #fcede3). Normalizacja polskich etykiet mocka na klucze mapy apki.
const SYNONYM: Record<string, string> = {
  klub: "club",
  sklep: "zakupy",
  miejsce: "landmark",
  spacer: "natura",
  restauraca: "restauracja",
};

export function placeIconSrc(category?: string | null): string {
  if (!category) return categoryIconSrc(null);
  const key = category.toLowerCase().trim();
  return categoryIconSrc(SYNONYM[key] ?? category);
}

// Grupa nadrzedna kategorii (jak w wizytowce apki: "Jedzenie & napoje" itp.).
const GROUP: Record<string, string> = {
  restauracja: "Jedzenie & napoje",
  restauraca: "Jedzenie & napoje",
  kawiarnia: "Jedzenie & napoje",
  bar: "Jedzenie & napoje",
  klub: "Nocne życie",
  muzeum: "Kultura",
  galeria: "Kultura",
  park: "Natura",
  "punkt widokowy": "Natura",
  spacer: "Natura",
  sklep: "Zakupy",
  miejsce: "Atrakcje",
};

export function categoryGroup(category?: string | null): string {
  if (!category) return "Atrakcje";
  return GROUP[category.toLowerCase().trim()] ?? "Atrakcje";
}
