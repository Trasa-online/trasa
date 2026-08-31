import { supabase } from "@/integrations/supabase/client";

// SafeSearch dla zdjec od uzytkownikow (App Store 1.2 - filtrowanie tresci nieodpowiednich).
// Wolane PO wgraniu pliku: gdy Vision odrzuci zdjecie, kasujemy je z galerii i ze Storage.
//
// FAIL-OPEN: brak klucza (GOOGLE_VISION_API_KEY nieustawiony), blad sieci albo timeout =
// zdjecie przechodzi. Moderacja jest dodatkowym sitem, a nie warunkiem dzialania aplikacji -
// zgloszenia (content_reports / place_flags) i tak zostaja druga linia.
export type ModerationVerdict = "ok" | "rejected" | "skipped";

export type ModerationContext = "place_photo" | "pin_photo" | "trip_gallery" | "list_item";

export async function moderateImageUrl(url: string, context?: ModerationContext): Promise<ModerationVerdict> {
  if (!url) return "skipped";
  try {
    const { data, error } = await supabase.functions.invoke("moderate-image", { body: { url, context } });
    if (error) { console.warn("[imageModeration]", error.message); return "skipped"; }
    const verdict = (data as any)?.verdict;
    return verdict === "rejected" ? "rejected" : verdict === "ok" ? "ok" : "skipped";
  } catch (e) {
    console.warn("[imageModeration] exception:", e instanceof Error ? e.message : e);
    return "skipped";
  }
}

/** Czy zdjecie mozna pokazac. `false` tylko dla jednoznacznego odrzucenia. */
export async function isImageAllowed(url: string, context?: ModerationContext): Promise<boolean> {
  return (await moderateImageUrl(url, context)) !== "rejected";
}

export const MODERATION_REJECTED_MESSAGE = "To zdjęcie nie przeszło moderacji i nie zostało dodane";
