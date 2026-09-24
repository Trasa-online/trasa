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


// ── RECZNE UZUPELNIENIE SPRZED EKSPORTU ─────────────────────────────────────
// Eksport rozliczen ruszyl 20.09 i Google nie uzupelnia go wstecz, wiec wrzesien ma w naszym
// zrodle dziure (dni 1-19). Panel pokazywal przez to inna kwote niz konsola Google - obie
// prawdziwe, ale nie ta sama. Brakujacy kawalek wpisuje sie RAZ, recznie, z konsoli.
// ⛔ Trzymane OSOBNO od `google_billing_daily`, zeby nikt po miesiacach nie wzial szacunku
// za dane z eksportu. Od pazdziernika tabela ma byc pusta.
export interface ManualBilling { month: string; amount: number; note: string | null }

export function useManualBilling(month: string) {
  return useQuery<ManualBilling | null>({
    queryKey: ["api-costs", "billing-manual", month],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("google_billing_manual").select("month, amount, note").eq("month", `${month}-01`).maybeSingle();
      return data ? { ...data, amount: Number(data.amount) } : null;
    },
  });
}

/** Zapis (admin). Pusta/zerowa kwota KASUJE wpis - inaczej zostawalaby zerowa pozycja w panelu. */
export async function saveManualBilling(month: string, amount: number | null, note?: string): Promise<{ ok: boolean; error?: string }> {
  const key = `${month}-01`;
  if (amount === null || !Number.isFinite(amount) || amount <= 0) {
    const { error } = await (supabase as any).from("google_billing_manual").delete().eq("month", key);
    return error ? { ok: false, error: error.message } : { ok: true };
  }
  const { data: me } = await supabase.auth.getUser();
  const { error } = await (supabase as any).from("google_billing_manual")
    .upsert({ month: key, amount, note: note ?? null, updated_by: me?.user?.id ?? null, updated_at: new Date().toISOString() }, { onConflict: "month" });
  return error ? { ok: false, error: error.message } : { ok: true };
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
