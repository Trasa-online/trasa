// localStorage history of places liked during HomeSwipe (exploreMode).
// Used to: (a) offer reusing today's likes when user starts solo route planning,
// (b) show "Polubione miejsca" tab in Eksploruj.

const STORAGE_KEY = "trasa_explore_likes_history";

export interface ExploreLike {
  place_name: string;
  category: string;
  latitude?: number | null;
  longitude?: number | null;
  photo_url?: string | null;
  address?: string | null;
  rating?: number | null;
  description?: string | null;
  liked_at: string; // ISO timestamp
}

export interface ExploreLikeGroup {
  date: string; // YYYY-MM-DD (local)
  city: string;
  places: ExploreLike[];
}

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function getHistory(): ExploreLikeGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((g: any) =>
      g && typeof g.date === "string" && typeof g.city === "string" && Array.isArray(g.places)
    );
  } catch {
    return [];
  }
}

function writeHistory(history: ExploreLikeGroup[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(history)); } catch { /* unavailable */ }
}

export function addLike(city: string, like: Omit<ExploreLike, "liked_at">) {
  const date = todayLocal();
  const history = getHistory();
  // Find or create today+city bucket
  let bucket = history.find(g => g.date === date && g.city === city);
  if (!bucket) {
    bucket = { date, city, places: [] };
    history.push(bucket);
  }
  // Dedupe by place_name (case-insensitive)
  const nameLower = like.place_name.toLowerCase();
  if (bucket.places.some(p => p.place_name.toLowerCase() === nameLower)) return;
  bucket.places.push({ ...like, liked_at: new Date().toISOString() });
  writeHistory(history);
}

export function removeLike(date: string, city: string, place_name: string) {
  const history = getHistory();
  const idx = history.findIndex(g => g.date === date && g.city === city);
  if (idx < 0) return;
  const nameLower = place_name.toLowerCase();
  history[idx] = {
    ...history[idx],
    places: history[idx].places.filter(p => p.place_name.toLowerCase() !== nameLower),
  };
  if (history[idx].places.length === 0) history.splice(idx, 1);
  writeHistory(history);
}

export function getTodayLikes(city: string): ExploreLike[] {
  const date = todayLocal();
  return getHistory().find(g => g.date === date && g.city === city)?.places ?? [];
}

// Zestawienie polubien per MIASTO (scalone ze wszystkich dni, zdedupowane po nazwie).
export interface ExploreCityGroup {
  city: string;
  places: ExploreLike[];
}
export function getHistoryByCity(): ExploreCityGroup[] {
  const byCity = new Map<string, ExploreLike[]>();
  for (const g of getHistory()) {
    const arr = byCity.get(g.city) ?? [];
    for (const p of g.places) {
      if (!arr.some(x => x.place_name.toLowerCase() === p.place_name.toLowerCase())) arr.push(p);
    }
    byCity.set(g.city, arr);
  }
  return [...byCity.entries()].map(([city, places]) => ({ city, places }));
}

// Usun polubienie z danego miasta (ze wszystkich dni).
export function removeLikeFromCity(city: string, place_name: string) {
  const nameLower = place_name.toLowerCase();
  const next = getHistory()
    .map(g => g.city === city ? { ...g, places: g.places.filter(p => p.place_name.toLowerCase() !== nameLower) } : g)
    .filter(g => g.places.length > 0);
  writeHistory(next);
}

// Wyczysc wszystkie polubienia danego miasta.
export function clearCity(city: string) {
  writeHistory(getHistory().filter(g => g.city !== city));
}

export function clearHistory() {
  writeHistory([]);
}

export function clearGroup(date: string, city: string) {
  const history = getHistory().filter(g => !(g.date === date && g.city === city));
  writeHistory(history);
}
