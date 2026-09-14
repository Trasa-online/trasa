import i18n from "@/i18n";

// Panel lokalu startuje PO POLSKU (prośba Nat 2026-09-14). Globalny detektor języka czyta
// `navigator.language`, więc właściciel lokalu z angielskim systemem/przeglądarką dostawał
// panel po angielsku - a to produkt sprzedawany polskim lokalom.
//
// Wyjątek: jeśli user SAM przełączył PL/EN w belce panelu, jego wybór wygrywa i zostaje na
// stałe. Rozróżniamy to osobnym kluczem, bo `i18nextLng` zapisuje detektor przy każdym
// wykryciu - po nim nie da się poznać, czy język został wybrany, czy tylko zgadnięty.
const CHOICE_KEY = "spontaway_biz_lang_choice";

/** Zapamiętaj JAWNY wybór języka w panelu (przełącznik PL/EN). */
export function markBusinessLangChoice(code: string) {
  try { localStorage.setItem(CHOICE_KEY, code); } catch { /* brak localStorage */ }
}

/** Ustaw język panelu: wybór usera, a gdy go nie ma - polski. Wołane przy wejściu do panelu. */
export function applyBusinessDefaultLanguage() {
  let chosen: string | null = null;
  try { chosen = localStorage.getItem(CHOICE_KEY); } catch { /* brak localStorage */ }
  const target = chosen === "en" || chosen === "pl" ? chosen : "pl";
  if (!(i18n.language || "").toLowerCase().startsWith(target)) void i18n.changeLanguage(target);
}
