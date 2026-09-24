import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarFrame from "@/components/profile/AvatarFrame";
import { avatarFrameKey } from "@/lib/avatarFrameLoader";
import { isAvatarFrame } from "@/lib/avatarFrames";
import { supabase } from "@/integrations/supabase/client";
import { avatarSrc } from "@/lib/avatar";
import { haptics } from "@/hooks/useHaptics";
import { fetchRewardGrant, markRewardSeen, rewardGrantKey } from "@/lib/rewardGrant";

// „DZIEKUJEMY ZA WSPARCIE" - baner na profilu dla osoby, ktorej przyznalismy nakladke RECZNIE
// (prosba Nat 2026-09-24). Nakladka, ktora po prostu pojawia sie w arkuszu „Customizuj", jest
// nie do zauwazenia - a to jest podziekowanie, wiec ma zostac powiedziane.
//
// ⛔ To NIE jest `FrameGiftSheet`. Prezent (`moonstars`, `banana`) dostaje pelnoekranowy arkusz,
// bo ma byc momentem; nagroda za przyprowadzenie ludzi jest spokojniejsza i stoi tam, gdzie
// user i tak patrzy - nad zakladkami profilu, w miejscu karty zaproszen.
//
// ⚠️ „Widziane" trzyma BAZA (`frame_grants.gift_seen_at`), nie localStorage - baner ma sie
// pokazac raz takze po reinstalacji i na drugim telefonie. Ta sama kolumna jest przelacznikiem
// PUBLIKACJI: grant wpisany z `gift_seen_at` = teraz daje nakladke bez banera, a wyzerowanie
// kolumny pokazuje baner przy najblizszym wejsciu na profil, bez zadnego deployu.
//
// ⛔ Zolte tlo marki #FDF184 + BRAZOWY tekst #5B2C06 (10:1). Pomaranczowy na zoltym ma 3,08:1,
// wiec zostaje wylacznie wypelnieniem guzika z bialym napisem.
const BG = "#FDF184";
const INK = "#5B2C06";

export default function RewardThanksBanner({ userId }: { userId: string }) {
  const { t } = useTranslation("profiles");
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  const { data: grant } = useQuery({
    queryKey: rewardGrantKey(userId),
    enabled: !!userId,
    staleTime: Infinity,
    queryFn: fetchRewardGrant,
  });

  const { data: me } = useQuery({
    queryKey: ["reward-grant-me", userId],
    enabled: !!userId && !!grant && !grant.seen,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles").select("avatar_url, first_name").eq("id", userId).maybeSingle();
      return data as { avatar_url: string | null; first_name: string | null } | null;
    },
  });

  if (!grant || grant.seen) return null;

  // Zamkniecie w kazdy sposob liczy sie jako „wiem" - baner, ktory wraca po odmowie,
  // przestaje byc podziekowaniem, a staje sie natarczywa reklama.
  const dismiss = async () => {
    queryClient.setQueryData(rewardGrantKey(userId), { frame: grant.frame, seen: true });
    await markRewardSeen(grant.frame);
  };

  // „Załóż" nakłada nagrode OD RAZU. Bez tego user musialby sam znalezc arkusz nakladek
  // w Ustawieniach - a nagroda, ktorej trzeba szukac, przestaje byc nagroda.
  const wearIt = async () => {
    if (busy) return;
    setBusy(true);
    haptics.success();
    const { error } = await (supabase as any).from("profiles").update({ avatar_frame: grant.frame }).eq("id", userId);
    if (error) { haptics.error(); toast.error(t("reward.wear_failed")); setBusy(false); return; }
    queryClient.invalidateQueries({ queryKey: ["profile-full", userId] });
    queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    queryClient.invalidateQueries({ queryKey: avatarFrameKey(userId) });
    toast.success(t("reward.wear_done"));
    setBusy(false);
    void dismiss();
  };

  return (
    <div className="mb-5 rounded-3xl px-5 pt-5 pb-3" style={{ background: BG }}>
      <div className="flex items-start gap-3">
        {/* Nakladka na WLASNYM zdjeciu - user ma zobaczyc, co dostal, a nie przeczytac o tym. */}
        <span className="relative mt-0.5 h-14 w-14 shrink-0">
          <AvatarFrame kind={isAvatarFrame(grant.frame) ? grant.frame : null} size={56} />
          <Avatar className="h-14 w-14">
            <AvatarImage src={avatarSrc(me?.avatar_url ?? null)} className="object-cover bg-orange-100" />
            <AvatarFallback className="bg-orange-100 text-primary text-lg font-black">
              {(me?.first_name ?? "?").charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: `${INK}B3` }}>
            {t("reward.eyebrow")}
          </p>
          <p className="mt-0.5 text-[16px] font-bold leading-snug" style={{ color: INK }}>
            {t("reward.title")}
          </p>
          <p className="mt-1 text-[13px] leading-relaxed" style={{ color: INK, opacity: 0.85 }}>
            {t("reward.desc")}
          </p>
        </div>
      </div>

      <button
        onClick={() => void wearIt()}
        disabled={busy}
        className="mt-4 h-11 w-full rounded-2xl bg-primary text-white font-bold text-[13px] uppercase tracking-wide flex items-center justify-center active:scale-[0.98] transition-transform disabled:opacity-60"
      >
        {t("reward.wear_cta")}
      </button>
      <button
        onClick={() => { haptics.light(); void dismiss(); }}
        className="mt-1 w-full py-2 text-center text-[13px] font-semibold active:opacity-70 transition-opacity"
        style={{ color: `${INK}B3` }}
      >
        {t("reward.later")}
      </button>
    </div>
  );
}
