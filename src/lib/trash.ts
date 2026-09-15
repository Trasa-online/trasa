import { supabase } from "@/integrations/supabase/client";

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
