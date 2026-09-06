import { supabase } from "@/integrations/supabase/client";
// zwykly modul bez Reacta, wiec siegamy po i18n bezposrednio.
import i18n from "@/i18n";

// SafeSearch dla zdjec od uzytkownikow (App Store 1.2 - filtrowanie tresci nieodpowiednich).
// Wolane PO wgraniu pliku: gdy Vision odrzuci zdjecie, kasujemy je z galerii i ze Storage.
//
// FAIL-OPEN: brak klucza (GOOGLE_VISION_API_KEY nieustawiony), blad sieci albo timeout =
// zdjecie przechodzi. Moderacja jest dodatkowym sitem, a nie warunkiem dzialania aplikacji -
// zgloszenia (content_reports / place_flags) i tak zostaja druga linia.
export type ModerationVerdict = "ok" | "rejected" | "skipped";

export type ModerationContext = "place_photo" | "pin_photo" | "trip_gallery" | "list_item";

/** Namiary obiektu, do ktorego zdjecie nalezalo - pozwalaja adminowi PRZYWROCIC referencje,
 *  gdy odrzucenie bylo falszywym alarmem (patrz edge function admin-restore-photo). */
export type ModerationTarget = {
  place_key?: string;
  place_name?: string;
  city?: string | null;
  route_id?: string;
};

export async function moderateImageUrl(url: string, context?: ModerationContext, target?: ModerationTarget): Promise<ModerationVerdict> {
  if (!url) return "skipped";
  try {
    const { data, error } = await supabase.functions.invoke("moderate-image", { body: { url, context, target } });
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

export const MODERATION_REJECTED_MESSAGE = i18n.t("moderation.rejected", { ns: "common" });
