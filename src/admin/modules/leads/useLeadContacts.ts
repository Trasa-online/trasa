// Kontakty do leadow: strona, telefon i adres e-mail lokalu, ktory nie ma jeszcze konta.
//
// ⚠️ Google Places NIE zwraca maila - ma tylko strone i telefon. Mail wyciagamy ze STRONY
// lokalu (edge `lead-contact-lookup`). Na probie 20 najczesciej dodawanych leadow z 15.09.2026
// wyszlo: telefon 15/20, wlasna strona 9/20, MAIL 5/20. Reszta to Instagram albo nic - i to
// jest normalny wynik w gastronomii, nie awaria wyszukiwania.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadContact {
  id: string;
  place_key: string;
  place_name: string;
  city: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  emails: string[];
  source_url: string | null;
  found_by: "website" | "google" | "manual" | null;
  status: "new" | "found" | "not_found" | "contacted";
  note: string | null;
  checked_at: string | null;
}

const norm = (s: string | null | undefined) => String(s ?? "").toLowerCase().trim();

/**
 * Wszystkie znane kontakty, indeksowane po kluczu miejsca. Dwa wpisy na klucz:
 * dokladny (nazwa + miasto) i zapasowy (sama nazwa) - miasto leada bywa puste w jednym
 * zrodle, a wypelnione w drugim, wiec bez tego ten sam lokal wygladalby na niesprawdzony.
 */
export function useLeadContacts() {
  return useQuery<Record<string, LeadContact>>({
    queryKey: ["lead-contacts"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any).from("lead_contacts").select("*").limit(2000);
      const map: Record<string, LeadContact> = {};
      for (const r of (data ?? []) as LeadContact[]) {
        map[`${r.place_key}|${norm(r.city)}`] = r;
        if (!map[r.place_key]) map[r.place_key] = r;
      }
      return map;
    },
  });
}

export const contactOf = (map: Record<string, LeadContact> | undefined, name: string, city: string | null) =>
  map?.[`${norm(name)}|${norm(city)}`] ?? map?.[norm(name)] ?? null;

/** Jedno klikniecie = dwa platne zapytania do Google, dlatego NIGDY nie robimy tego hurtem. */
export function useLookupContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ placeName, city, force }: { placeName: string; city: string | null; force?: boolean }) => {
      const { data, error } = await supabase.functions.invoke("lead-contact-lookup", {
        body: { place_name: placeName, city: city ?? undefined, force: force === true },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as any).contact as LeadContact;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-contacts"] }),
  });
}

/** Reczna poprawka: wpisany adres, notatka, oznaczenie "wyslano oferte". */
export function useSaveLeadContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<LeadContact> }) => {
      const { error } = await (supabase as any).from("lead_contacts").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-contacts"] }),
  });
}

/** Wiersz dla leada, ktorego jeszcze nikt nie sprawdzal - zeby dalo sie wpisac kontakt recznie. */
export function useCreateLeadContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ placeName, city }: { placeName: string; city: string | null }) => {
      const { data, error } = await (supabase as any).from("lead_contacts")
        .insert({ place_key: norm(placeName), place_name: placeName, city, status: "new" })
        .select("*").single();
      if (error) throw error;
      return data as LeadContact;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead-contacts"] }),
  });
}
