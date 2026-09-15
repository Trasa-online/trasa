import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { queryClient } from "@/lib/queryClient";
import { haptics } from "@/hooks/useHaptics";
import i18n from "@/i18n";

// KOSZ (prosba Nat 2026-09-15). "Usun" na wyjezdzie i kolekcji NIE kasuje juz danych -
// ustawia `deleted_at`, a prawdziwe kasowanie robi cron po 7 dniach (migracja 20260915b).
//
// Dlaczego przez RPC, a nie zwyklym `.update({ deleted_at })`: polityki SELECT na obu
// tabelach maja teraz `deleted_at IS NULL`, wiec po wrzuceniu do kosza wiersz przestaje byc
// widoczny takze dla wlasciciela - nie da sie go ani odczytac, ani odeslac z `returning`.
// Cztery SECURITY DEFINER RPC sa jedynym oknem na te wiersze i kazdy z nich sam sprawdza
// `user_id = auth.uid()`.
//
// ⛔ NIE kasuj dzieci (pins / discovery_items) przy usuwaniu z UI - odzyskany wyjazd ma
// wrocic kompletny. Kaskada FK i tak zrobi to za nas dopiero przy realnym DELETE.

export type TrashKind = "trip" | "list";

export interface TrashEntry {
  kind: TrashKind;
  id: string;
  title: string | null;
  cover: string | null;
  items: number;
  deleted_at: string;
  /** Moment, po ktorym cron skasuje wpis na dobre (deleted_at + 7 dni). */
  expires_at: string;
}

export const TRASH_DAYS = 7;
export const trashKey = ["trash"] as const;

/** Wyjazd / kolekcja -> kosz. `true` = faktycznie cos przeniesiono. */
export async function moveToTrash(kind: TrashKind, id: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc("soft_delete_content", { p_kind: kind, p_id: id });
  if (error) { console.warn("[trash] soft_delete_content:", error.message); throw error; }
  return data === true;
}

/** Wiele pozycji naraz (zaznaczanie na profilu). Zwraca liczbe przeniesionych. */
export async function moveManyToTrash(kind: TrashKind, ids: string[]): Promise<number> {
  const results = await Promise.all(ids.map((id) => moveToTrash(kind, id).catch(() => false)));
  return results.filter(Boolean).length;
}

export async function fetchTrash(): Promise<TrashEntry[]> {
  const { data, error } = await (supabase as any).rpc("my_trash");
  if (error) { console.warn("[trash] my_trash:", error.message); return []; }
  return (data ?? []) as TrashEntry[];
}

export async function restoreFromTrash(kind: TrashKind, id: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc("restore_from_trash", { p_kind: kind, p_id: id });
  if (error) { console.warn("[trash] restore_from_trash:", error.message); throw error; }
  return data === true;
}

/** Nieodwracalne skasowanie POZYCJI Z KOSZA (nie dziala na zywym wyjezdzie). */
export async function purgeFromTrash(kind: TrashKind, id: string): Promise<boolean> {
  const { data, error } = await (supabase as any).rpc("purge_from_trash", { p_kind: kind, p_id: id });
  if (error) { console.warn("[trash] purge_from_trash:", error.message); throw error; }
  return data === true;
}

/** Ile pelnych dni zostalo do skasowania (0 = dzis). */
export function daysLeft(expiresAt: string): number {
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}


// ── Odswiezanie list po usunieciu / przywroceniu ────────────────────────────────────────
//
// Zgloszenie Nat 2026-09-15: "usuwam wyjazd, wracam na profil i nadal go widze". Przyczyny
// byly dwie i obie strukturalne:
//
//  1. KAZDE miejsce usuwania uniewazniało tylko SWOJE klucze. Usuniecie kolekcji
//     z Eksploracji odswiezalo `my-collections`, z jej widoku - `profile-list-feed`,
//     a z karty w feedzie - `explore-rankings`. Wystarczylo usunac z innego ekranu, niz
//     ten, na ktory sie wracalo, i tresc zostawala w cache.
//  2. Usuniecie bylo ODROCZONE o 5 s (`deferDelete` + toast "Cofnij"), wiec commit
//     wykonywal sie z setTimeouta JUZ PO odmontowaniu ekranu. Gdy user w tym czasie
//     zamknal apke albo iOS uspil WebView, zapis nie szedl w ogole - "usuniete" wracalo
//     po restarcie.
//
// Dlatego: usuwamy OD RAZU (to jeden tani UPDATE), a "Cofnij" w toascie przywraca z kosza.
// Lista kluczy zyje TUTAJ, w warstwie danych - zaden ekran nie musi juz o niej pamietac.
const CONTENT_LIST_KEYS = [
  "profile-trip-feed", "profile-list-feed", "profile-saved-trip-feed", "profile-saved-list-feed",
  "public-trip-feed", "public-list-feed", "public-profile-lists",
  "explore-grid", "explore-rankings", "explore-search", "discovery-city-routes", "discovery-polecane",
  "my-collections", "saved-collections", "saved-routes", "saved-routes-count",
  "start-robocze", "start-zapisane", "home-active-solo", "active-routes", "journal-entries",
  "folder-routes", "lists-with-places", "save-sheet-lists", "starred-places",
  "shared-list", "shared-route", "trash",
];

/** Odswiez KAZDA liste, na ktorej moze stac wyjazd albo kolekcja. */
export function invalidateContentLists(): void {
  for (const key of CONTENT_LIST_KEYS) queryClient.invalidateQueries({ queryKey: [key] });
}

/**
 * Usun wyjazd / kolekcje OD RAZU i pokaz toast z "Cofnij" (przywraca z kosza).
 * Zwraca `true`, gdy cokolwiek zostalo przeniesione do kosza.
 *
 * ⛔ NIE owijaj tego w `deferDelete` - to wlasnie odroczenie o 5 s bylo zrodlem bledu
 * "usunalem, a wciaz jest". Tu zapis idzie natychmiast, a cofniecie to osobny RPC.
 */
export async function deleteWithUndo(kind: TrashKind, ids: string | string[], opts: { message: string; undoLabel?: string; failMessage?: string }): Promise<boolean> {
  const list = Array.isArray(ids) ? ids : [ids];
  let moved = 0;
  try {
    moved = list.length === 1 ? ((await moveToTrash(kind, list[0])) ? 1 : 0) : await moveManyToTrash(kind, list);
  } catch { moved = 0; }
  if (moved === 0) {
    if (opts.failMessage) toast.error(opts.failMessage);
    invalidateContentLists();
    return false;
  }
  invalidateContentLists();
  toast(opts.message, {
    action: {
      label: opts.undoLabel ?? i18n.t("common:undo"),
      onClick: () => {
        haptics.light();
        void Promise.all(list.map((id) => restoreFromTrash(kind, id).catch(() => false)))
          .then(() => invalidateContentLists());
      },
    },
  });
  return true;
}
