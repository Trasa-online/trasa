import { pl, enUS } from "date-fns/locale";
import type { Locale } from "date-fns";
import i18n from "@/i18n";

// Zwraca locale date-fns zgodne z aktywnym jezykiem i18n. Bez tego daty (format/
// formatDistanceToNow) renderowaly sie po polsku nawet gdy UI byl po angielsku.
// Wolane w miejscu formatowania (render time), wiec podaza za jezykiem po jego zmianie.
export function dateLocale(): Locale {
  return (i18n.language || "").toLowerCase().startsWith("en") ? enUS : pl;
}
