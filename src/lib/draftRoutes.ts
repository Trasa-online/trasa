// Trasy robocze (drafty) - lokalny zapis niedokończonego planowania, żeby user nie zaczynał
// od zera. Gdy wybrał miasto + datę i polubił kilka miejsc, ale jeszcze NIE wygenerował trasy,
// stan zapisuje się tu i wraca jako karta "Dokończ trasę" na home. Per urządzenie (localStorage),
// przetrwa restart natywki. Jeden aktywny draft per miasto (upsert). Polubienia trzymamy jako
// listę nazw - swiper przy resume oznaczy pasujące miejsca jako polubione (initialLikedPlaceNames).

export interface DraftRoute {
  city: string;
  date: string | null; // trip date ISO
  numDays: number;
  startingLocation?: string | { name: string; latitude: number; longitude: number };
  likedPlaceNames: string[];
  updatedAt: number;
}

const KEY = "trasa_draft_routes";
const cityKey = (c: string) => (c || "").trim().toLowerCase();

function readAll(): DraftRoute[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeAll(list: DraftRoute[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* localStorage unavailable */ }
}

// Upsert po mieście (jeden aktywny draft per miasto). Pusty/bez polubień = nie zapisujemy.
export function saveDraft(d: Omit<DraftRoute, "updatedAt">) {
  if (!d.city || !d.likedPlaceNames?.length) return;
  const list = readAll().filter((x) => cityKey(x.city) !== cityKey(d.city));
  list.push({ ...d, updatedAt: Date.now() });
  writeAll(list);
}

// Drafty posortowane od najnowszego.
export function getDrafts(): DraftRoute[] {
  return readAll().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function removeDraft(city: string) {
  writeAll(readAll().filter((x) => cityKey(x.city) !== cityKey(city)));
}
