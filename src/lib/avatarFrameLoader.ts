import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Ramka awatara (profiles.avatar_frame / avatar_frame_color) dla DOWOLNEGO usera po id -
// jeden hook do wszystkich miejsc, gdzie pokazujemy cudzy awatar (karty list i wyjazdow,
// autor w feedzie, kafelki eksploracji, arkusz udostepniania). Prosba Nat 2026-09-11:
// nakladka ma byc widoczna wszedzie, nie tylko na duzym awatarze profilu.
//
// Dlaczego osobny loader, a nie kolumny w kazdym zapytaniu: awatary autorow plyna z kilkunastu
// roznych zapytan (czesc ma awatar zdenormalizowany w wierszu listy, czesc dociaga profile
// osobno). Zamiast dopisywac dwie kolumny w kazdym z nich, karta pyta o ramke po `userId`,
// a loader ZBIERA pytania z jednego cyklu renderu w JEDNO zapytanie `in(...)`. TanStack
// trzyma wynik per user (5 min), wiec ta sama osoba na kilku kartach = jedno pobranie.
//
// Blad = brak ramki (nigdy nie wywala widoku - to dekoracja).

export type AvatarFrameInfo = { frame: string | null; color: string | null };

const NONE: AvatarFrameInfo = { frame: null, color: null };
const CHUNK = 100;

const queue = new Set<string>();
const waiters = new Map<string, Array<(r: AvatarFrameInfo) => void>>();
let scheduled = false;

async function flush() {
  scheduled = false;
  const ids = Array.from(queue);
  queue.clear();
  const found = new Map<string, AvatarFrameInfo>();
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    try {
      const { data } = await (supabase as any)
        .from("profiles").select("id, avatar_frame, avatar_frame_color").in("id", chunk);
      for (const p of data ?? []) found.set(p.id, { frame: p.avatar_frame ?? null, color: p.avatar_frame_color ?? null });
    } catch (e) {
      console.warn("[avatarFrameLoader] fetch failed:", (e as Error)?.message ?? e);
    }
  }
  for (const id of ids) {
    const r = found.get(id) ?? NONE;
    for (const w of waiters.get(id) ?? []) w(r);
    waiters.delete(id);
  }
}

export function loadAvatarFrame(userId: string): Promise<AvatarFrameInfo> {
  return new Promise((resolve) => {
    queue.add(userId);
    if (!waiters.has(userId)) waiters.set(userId, []);
    waiters.get(userId)!.push(resolve);
    if (!scheduled) { scheduled = true; setTimeout(flush, 0); }
  });
}

export const avatarFrameKey = (userId: string | null | undefined) => ["avatar-frame", userId ?? null] as const;

/** Ramka usera po id; `undefined` dopoki sie laduje albo gdy nie ma id. */
export function useAvatarFrame(userId: string | null | undefined): AvatarFrameInfo | undefined {
  const { data } = useQuery({
    queryKey: avatarFrameKey(userId),
    enabled: !!userId,
    queryFn: () => loadAvatarFrame(userId!),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });
  return data;
}
