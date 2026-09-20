// „Podziękuj" - jedyny kanal lokal -> uzytkownik w calej aplikacji.
//
// Po co: notatka goscia to jedyna waluta zaufania, jaka mamy (⛔ zero gwiazdek i ocen).
// Lokal, ktory moze za nia podziekowac, zamyka petle - czlowiek widzi, ze jego zdanie
// doszlo do adresata, i chetniej napisze nastepne.
//
// Kanal jest WASKI z premedytacja: jedno podziekowanie za ta sama tresc (RPC pilnuje tego
// po stronie bazy) i limit na dobe z jednego lokalu. Panel nigdy nie dostaje `user_id`
// autora - RPC przyjmuje nazwe uzytkownika, ktora lokal i tak widzi przy notatce.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Heart, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export interface ThanksButtonProps {
  businessId: string;
  /** Nazwa uzytkownika autora tresci. Brak = nie ma komu dziekowac (tresc anonimowa). */
  username: string | null;
  kind: "note" | "photo";
  /** Klucz tresci - po nim baza rozpoznaje, ze juz dziekowalismy. */
  refKey: string;
  alreadySent: boolean;
  onSent: (refKey: string) => void;
}

export function ThanksButton({ businessId, username, kind, refKey, alreadySent, onSent }: ThanksButtonProps) {
  const { t } = useTranslation("bizdash");
  const [busy, setBusy] = useState(false);

  if (!username) return null;

  const send = async () => {
    setBusy(true);
    const { data, error } = await (supabase as any).rpc("notify_business_thanks", {
      p_business_id: businessId,
      p_username: username,
      p_kind: kind,
      p_ref: refKey,
    });
    setBusy(false);

    if (error) { toast.error(error.message || t("community.thanks_error")); return; }
    const reason = (data as any)?.reason;
    if ((data as any)?.sent) {
      toast.success(t("community.thanks_sent", { user: username }));
      onSent(refKey);
      return;
    }
    // Odmowa nie jest bledem - mowimy, co sie stalo, i domykamy guzik tam, gdzie to ma sens.
    if (reason === "already") { toast.info(t("community.thanks_already")); onSent(refKey); return; }
    if (reason === "limit") { toast.info(t("community.thanks_limit")); return; }
    toast.info(t("community.thanks_no_user"));
  };

  if (alreadySent) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 py-2 text-[13px] font-bold text-emerald-600">
        <Check className="h-3.5 w-3.5" />
        {t("community.thanks_done")}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={send}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Heart className="h-3.5 w-3.5" />}
      {t("community.thanks_cta")}
    </button>
  );
}
