// Deterministyczna walidacja godzin otwarcia (double-check przy tworzeniu trasy).
// Bazuje na STRUKTURALNYCH godzinach biznesu (business_profiles.opening_hours):
//   { mon: { open: "09:00", close: "18:00" } | { closed: true }, ... }
// Miejsca bez tych danych zwracają null -> traktujemy jako "nie wiemy", NIE ostrzegamy
// (zero false-positive). Google weekday_text (miejsca niebiznesowe) - poza zakresem v1.

export type DayHours = { open: string; close: string } | { closed: true };
export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type OpeningHours = Partial<Record<WeekdayKey, DayHours>>;

// getDay(): 0=niedziela ... 6=sobota.
const DAY_BY_INDEX: WeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function weekdayKeyFromDate(date: Date): WeekdayKey {
  return DAY_BY_INDEX[date.getDay()];
}

// "HH:MM" -> minuty od północy; null gdy format niepoprawny/pusty.
function toMinutes(t: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((t ?? "").trim());
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export interface OpenCheck {
  open: boolean;
  closedAllDay?: boolean; // dzień oznaczony jako zamknięty
  closes?: string;        // godzina zamknięcia ("18:00") gdy zamknięte o danej porze
}

// Czy miejsce jest otwarte o godzinie `arrival` w dniu `weekday`.
// null = brak danych (nie wiemy) -> pomijamy w walidacji.
export function isOpenAt(
  hours: OpeningHours | null | undefined,
  weekday: WeekdayKey,
  arrival: string | null | undefined,
): OpenCheck | null {
  if (!hours || typeof hours !== "object") return null;
  const day = hours[weekday];
  if (!day) return null; // brak danych dla tego dnia
  if ("closed" in day && day.closed) return { open: false, closedAllDay: true };
  if (!("open" in day)) return null;

  const a = toMinutes(arrival);
  if (a == null) return null; // brak sensownej godziny przybycia
  const openMin = toMinutes(day.open);
  const closeMin = toMinutes(day.close);
  if (openMin == null || closeMin == null) return null;

  // Zamknięcie po północy (close <= open, np. bar 18:00-02:00) -> przesuwamy o dobę.
  const closeAdj = closeMin <= openMin ? closeMin + 24 * 60 : closeMin;
  const open = a >= openMin && a < closeAdj;
  return open ? { open: true } : { open: false, closes: day.close };
}
