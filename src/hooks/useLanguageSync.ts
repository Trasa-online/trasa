import { useEffect } from "react";
import i18n from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Jezyk interfejsu -> profiles.language (2026-09-06).
//
// Po co baza ma o tym wiedziec: pushe buduje trigger `notify_push` po stronie serwera, przy
// ZAMKNIETEJ apce. Bez tej kolumny kazdy push szedl po polsku, niezaleznie od tego, w jakim
// jezyku user widzi aplikacje. To samo dotyczy maili.
//
// Zapisujemy przy KAZDEJ zmianie jezyka oraz raz po zalogowaniu (konta zalozone przed ta
// zmiana maja NULL, a wykrycie z ustawien telefonu juz sie odbylo - wiec jest co zapisac).
// Best-effort: blad zapisu nie moze niczego w apce zatrzymac, najwyzej push przyjdzie po polsku.
const norm = (lng: string | undefined): "pl" | "en" =>
  (lng || "").toLowerCase().startsWith("en") ? "en" : "pl";

export function useLanguageSync() {
  const { user, isAnonymous } = useAuth();

  useEffect(() => {
    if (!user?.id || isAnonymous) return;
    let cancelled = false;

    const push = (lng: string | undefined) => {
      const value = norm(lng);
      void (supabase as any)
        .from("profiles")
        .update({ language: value })
        .eq("id", user.id)
        .then(({ error }: { error: { message: string } | null }) => {
          if (error && !cancelled) console.warn("[languageSync]", error.message);
        });
    };

    push(i18n.language);
    i18n.on("languageChanged", push);
    return () => { cancelled = true; i18n.off("languageChanged", push); };
  }, [user?.id, isAnonymous]);
}
