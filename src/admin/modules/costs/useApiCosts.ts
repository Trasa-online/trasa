import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Podglad zuzycia platnych wywolan Google Places API (monitoring kosztu).
// Zrodla: RPC textsearch_month_usage() (miesieczny licznik Text Search wyszukiwarki)
// oraz google_quota_usage() (dzienny licznik wszystkich platnych wywolan Google).
// Oba SECURITY DEFINER - czytaja tabele z RLS bez polityk.

// Limity MUSZA byc zsynchronizowane z domyslnymi wartosciami env w edge function
// google-places-proxy (GOOGLE_TEXTSEARCH_MONTHLY_LIMIT, GOOGLE_DAILY_CALL_LIMIT).
// To tylko wartosci do WYSWIETLENIA - faktyczny limit egzekwuje edge function.
export const TEXTSEARCH_MONTHLY_LIMIT = 8000;
export const DAILY_CALL_LIMIT = 2500;
// ⛔ Bez przeliczania wywolan na dolary (2026-09-20). Do tego dnia panel mnozyl licznik przez
// cennik katalogowy ($32/1000) i pokazywal "$52", gdy faktura Google mowila 23,85 zl - bo Google
// ma darmowa pule per SKU, a licznik nie widzi geokodowania, Maps JS ani zdjec. Kwota do zaplaty
// idzie z eksportu rozliczen (google_billing_daily), liczniki zostaja TYLKO jako stan limitow.

export interface BillingRow {
  day: string;        // YYYY-MM-DD (czas polski)
  project_id: string;
  service: string;    // np. "Places API"
  sku: string;        // np. "Text Search"
  cost: number;       // koszt katalogowy
  credits: number;    // rabaty + darmowa pula (dodatnie)
  currency: string;   // waluta konta rozliczeniowego (PLN)
  synced_at: string;
}

/** Rachunek Google z eksportu rozliczen (ostatnie 3 miesiace). RPC admin-only. */
export function useGoogleBilling() {
  return useQuery<BillingRow[]>({
    queryKey: ["api-costs", "google-billing"],
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("google_billing_summary");
      if (error) throw error;
      return ((data ?? []) as any[]).map((r) => ({ ...r, cost: Number(r.cost), credits: Number(r.credits) })) as BillingRow[];
    },
  });
}

/** "Odswiez teraz" - funkcja brzegowa dociaga eksport z BigQuery (gate: admin). */
export async function syncGoogleBilling(): Promise<{ ok: boolean; rows?: number; error?: string; note?: string }> {
  const { data, error } = await supabase.functions.invoke("google-billing-sync", { body: {} });
  if (error) return { ok: false, error: error.message };
  return data as any;
}

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
