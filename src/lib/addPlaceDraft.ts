import type { PlaceForList } from "@/lib/placeLists";

// NIEDOKONCZONY WYBOR MIEJSC w arkuszu „Dodaj nowe miejsce" (zgloszenie Nat 2026-09-24:
// „przy wyjsciu z arkusza (niechcacy) miejsca nie moga sie gubic").
//
// Arkusz przy kazdym otwarciu czyscil caly stan, wiec jedno machniecie palcem w dol - a to
// gest, ktory w tej apce zamyka KAZDY arkusz - kasowalo prace z kilkunastu tapniec: wyszukane
// frazy, wybrane wyniki Google, zaznaczone kafelki.
//
// ⚠️ Pamiec jest MODULOWA, nie w `localStorage`: wybor ma zyc tyle, co uruchomienie apki.
// Ta sama zasada, co przy pozycji scrolla (`useScrollRestore`) - po restarcie user oczekuje
// czystego arkusza, a nie zaznaczen sprzed dwoch dni.
//
// ⛔ „Anuluj" NIE jest wypadkiem: swiadoma rezygnacja czysci szkic (patrz `AddPlaceSheet`).
// Inaczej user, ktory celowo zrezygnowal, dostawalby swoje stare zaznaczenia z powrotem.

export interface AddPlaceDraft {
  /** Zaznaczone do dodania. */
  selected: PlaceForList[];
  /** Wybrane z wyszukiwarki - maja wlasny blok na gorze arkusza, wiec bez nich zaznaczenie
   *  bylo by NIEWIDOCZNE (licznik „Dodaj (3)" bez ani jednego widocznego wiersza). */
  manual: PlaceForList[];
  query: string;
}

const drafts = new Map<string, AddPlaceDraft>();

export function saveAddPlaceDraft(key: string | undefined, draft: AddPlaceDraft): void {
  if (!key) return;
  if (!draft.selected.length && !draft.manual.length && !draft.query.trim()) { drafts.delete(key); return; }
  drafts.set(key, draft);
}

export function loadAddPlaceDraft(key: string | undefined): AddPlaceDraft | null {
  return key ? drafts.get(key) ?? null : null;
}

export function clearAddPlaceDraft(key: string | undefined): void {
  if (key) drafts.delete(key);
}
