import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Languages } from "lucide-react";
import { toast } from "sonner";
import { needsTranslation, translateText } from "@/lib/translate";
import { haptics } from "@/hooks/useHaptics";

// Tresc usera z guzikiem "Przetlumacz" (decyzja Nat 2026-09-18). Renderuje SAM akapit, zeby
// kazde miejsce w apce (notka przy miejscu, opis wyjazdu, opis kolekcji, "Od uzytkownikow"
// na wizytowce) mialo ten sam wzorzec: oryginal -> tap -> tlumaczenie W MIEJSCU oryginalu +
// wiersz "Przetlumaczono · Pokaz oryginal" (wzor Instagrama). Oryginal nigdy nie znika - to
// cudza tresc i user ma do niego jeden tap.
//
// Guzik pojawia sie WYLACZNIE, gdy zgadniety jezyk tresci rozni sie od jezyka interfejsu
// (lib/translate `guessLang`, bez sieci). Po polsku w polskiej apce nie ma go wcale.
export default function TranslatableText({ text, className = "", buttonClassName = "" }: {
  text: string;
  /** Klasy akapitu - te same, co mial dotad `<p>` w miejscu uzycia. */
  className?: string;
  buttonClassName?: string;
}) {
  const { t } = useTranslation("common");
  const [translated, setTranslated] = useState<string | null>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [loading, setLoading] = useState(false);
  // Nowa tresc (np. edycja notki) = stare tlumaczenie nieaktualne.
  useEffect(() => { setTranslated(null); setShowOriginal(false); }, [text]);

  const offer = needsTranslation(text);
  const run = async () => {
    if (loading) return;
    haptics.light();
    setLoading(true);
    const res = await translateText(text);
    setLoading(false);
    if (!res.ok) {
      toast.error(res.reason === "limit" ? t("translate.limit") : t("translate.failed"));
      return;
    }
    setTranslated(res.text);
    setShowOriginal(false);
  };

  const showing = translated && !showOriginal ? translated : text;
  return (
    <>
      <p className={className}>{showing}</p>
      {offer && (
        <div className={`mt-1 flex items-center gap-1 text-[12px] font-semibold text-[#5B2C06]/70 ${buttonClassName}`}>
          {translated ? (
            <>
              <span>{showOriginal ? t("translate.original_shown") : t("translate.translated")}</span>
              <span aria-hidden>·</span>
              <button type="button" onClick={() => { haptics.selection(); setShowOriginal((v) => !v); }} className="underline underline-offset-2 active:opacity-70">
                {showOriginal ? t("translate.show_translation") : t("translate.show_original")}
              </button>
            </>
          ) : (
            <button type="button" onClick={run} disabled={loading} className="inline-flex items-center gap-1 active:opacity-70 disabled:opacity-60">
              <Languages className="h-3.5 w-3.5" strokeWidth={2.2} />
              {loading ? t("translate.loading") : t("translate.button")}
            </button>
          )}
        </div>
      )}
    </>
  );
}
