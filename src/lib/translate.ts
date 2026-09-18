import i18n from "@/i18n";
import { supabase } from "@/integrations/supabase/client";

// Tlumaczenie tresci userow NA ZADANIE (decyzja Nat 2026-09-18): funkcja brzegowa
// `translate-text` (Claude Haiku przez API Anthropica, cache + limity w bazie). Klient
// nigdy nie tlumaczy sam z siebie - guzik pokazuje sie tylko, gdy zgadniety jezyk tresci
// rozni sie od jezyka interfejsu, a tlumaczenie leci dopiero po tapnieciu.

export type Lang = "pl" | "en";

/** Jezyk interfejsu sprowadzony do pl/en (inne ustawienia systemu traktujemy jak EN). */
export function uiLang(): Lang {
  return (i18n.language || "pl").toLowerCase().startsWith("pl") ? "pl" : "en";
}

const PL_MARKS = /[ąćęłńóśźż]/i;
const PL_WORDS = /\b(i|w|na|nie|jest|się|to|do|z|że|tu|jak|ale|bardzo|warto|było|były|są|dla|przy|od|po|ma|mają|tam|tego|oraz)\b/gi;
const EN_WORDS = /\b(the|and|is|are|was|were|with|for|this|that|you|very|there|here|great|good|place|best|nice|worth|of|to|in|on|at|it)\b/gi;

/** Zgadywanie jezyka tresci BEZ sieci: polskie znaki rozstrzygaja od razu, potem liczymy
 *  najczestsze slowa. `null` = za malo sygnalu (krotka notka, same emoji, nazwa wlasna)
 *  - wtedy guzika NIE pokazujemy, zeby nie proponowac tlumaczenia "Manna 2 🍜". */
export function guessLang(text: string): Lang | null {
  const t = (text ?? "").trim();
  if (t.length < 12) return null;
  if (PL_MARKS.test(t)) return "pl";
  const pl = (t.match(PL_WORDS) ?? []).length;
  const en = (t.match(EN_WORDS) ?? []).length;
  if (pl === 0 && en === 0) return null;
  if (pl >= 2 && pl > en) return "pl";
  if (en >= 2 && en > pl) return "en";
  return null;
}

/** Czy pod ta trescia ma stac guzik "Przetlumacz". */
export function needsTranslation(text: string | null | undefined): boolean {
  if (!text) return false;
  const g = guessLang(text);
  return !!g && g !== uiLang();
}

export type TranslateResult = { ok: true; text: string; cached: boolean; reason?: undefined } | { ok: false; reason: "limit" | "unauthorized" | "failed" };

export async function translateText(text: string, target: Lang = uiLang()): Promise<TranslateResult> {
  try {
    const { data, error } = await supabase.functions.invoke("translate-text", { body: { text, target_lang: target } });
    if (error) {
      // supabase-js oddaje status w `context` (Response) - 429 = limit, 401 = brak sesji.
      const status = (error as any)?.context?.status ?? 0;
      console.warn("[translate] failed:", status, error.message);
      return { ok: false, reason: status === 429 ? "limit" : status === 401 ? "unauthorized" : "failed" };
    }
    if (!data?.translated) return { ok: false, reason: "failed" };
    return { ok: true, text: String(data.translated), cached: !!data.cached };
  } catch (e) {
    console.warn("[translate] threw:", e instanceof Error ? e.message : e);
    return { ok: false, reason: "failed" };
  }
}
