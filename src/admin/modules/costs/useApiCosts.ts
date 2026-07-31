import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Podglad zuzycia platnych wywolan Google Places API (monitoring kosztu).
// Zrodla: RPC textsearch_month_usage() (miesieczny licznik Text Search wyszukiwarki)
// oraz google_quota_usage() (dzienny licznik wszystkich platnych wywolan Google).
// Oba SECURITY DEFINER - czytaja tabele z RLS bez polityk.

// Limity MUSZA byc zsynchronizowane z domyslnymi wartosciami env w edge function
// google-places-proxy (GOOGLE_TEXTSEARCH_MONTHLY_LIMIT, GOOGLE_DAILY_CALL_LIMIT).
// To tylko wartosci do WYSWIETLENIA - faktyczny limit egzekwuje edge function.
export const TEXTSEARCH_MONTHLY_LIMIT = 8000; // ~$256 @ $32/1000
export const DAILY_CALL_LIMIT = 2500;
export const TEXTSEARCH_COST_PER_CALL = 0.032; // $32 / 1000 (Google Text Search)

export interface MonthUsage {
  month: string; // YYYY-MM-DD (pierwszy dzien miesiaca)
  textsearch_calls: number;
}

export interface DayUsage {
  day: string; // YYYY-MM-DD
  google_calls: number;
}

export function useTextsearchMonthly() {
  return useQuery<MonthUsage[]>({
    queryKey: ["api-costs", "textsearch-month"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("textsearch_month_usage");
      if (error) throw error;
      return (data ?? []) as MonthUsage[];
    },
  });
}

export function useDailyGoogleQuota() {
  return useQuery<DayUsage[]>({
    queryKey: ["api-costs", "daily-google"],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("google_quota_usage");
      if (error) throw error;
      return (data ?? []) as DayUsage[];
    },
  });
}
