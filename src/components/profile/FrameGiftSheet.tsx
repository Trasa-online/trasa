import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarFrame from "@/components/profile/AvatarFrame";
import { avatarFrameKey } from "@/lib/avatarFrameLoader";
import { isAvatarFrame } from "@/lib/avatarFrames";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { avatarSrc } from "@/lib/avatar";
import { haptics } from "@/hooks/useHaptics";

// PREZENT: nakladka przyznana imiennie (wpis w `frame_grants`) wita sie z userem RAZ - osobnym
// arkuszem z podziekowaniem, a nie kropka przy Ustawieniach. Prosba Nat 2026-09-16 dla osoby,
// ktora wspiera projekt od poczatku.
//
// Dlaczego osobny ekran, a nie toast: prezent ma byc momentem. Toast znika po 4 sekundach
// i laduje w tej samej kolejce, co "Zapisano zmiany" - a to jest jedyne takie zdarzenie
// w calym zyciu konta.
//
// ⚠️ "Widziane" trzyma BAZA (`frame_grants.gift_seen_at`, RPC `mark_frame_gift_seen`), nie
// localStorage: prezent ma sie pokazac raz takze po reinstalacji apki i na drugim telefonie.
// Zamkniecie arkusza w KAZDY sposob (guzik, gest w dol, tlo) liczy sie jako odebranie -
// inaczej ktos, kto przypadkiem zjechal palcem, dostawalby go w kolko.
//
// ⛔ Zoltego tla NIE zamieniaj na biale. To jedyny ekran w apce, ktory ma byc swietem;
// na zoltym piszemy WYLACZNIE brazem `#5B2C06` (10:1), pomaranczowy zostaje wypelnieniem
// guzika z bialym napisem - ta sama para, co w hero B2B.
const GIFT_BG = "#FDF184";
const GIFT_INK = "#5B2C06";

export default function FrameGiftSheet() {
  const { user } = useAuth();
  const { t } = useTranslation("settings");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Jaki prezent czeka nieodebrany. RPC oddaje NULL, gdy nic nie ma - wiec to jedno
  // lekkie zapytanie na start sesji, bez nasluchow.
  const { data: gift } = useQuery({
    queryKey: ["frame-gift", user?.id],
    enabled: !!user?.id,
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("my_frame_gift");
      if (error) { console.warn("[FrameGiftSheet] my_frame_gift:", error.message); return null; }
      return (data as string | null) ?? null;
    },
  });

  const { data: me } = useQuery({
    queryKey: ["frame-gift-me", user?.id],
    enabled: !!user?.id && !!gift,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles").select("avatar_url, first_name").eq("id", user!.id).maybeSingle();
      return data as { avatar_url: string | null; first_name: string | null } | null;
    },
  });

  useEffect(() => { if (gift) setOpen(true); }, [gift]);

  const markSeen = async () => {
    if (!gift) return;
    await (supabase as any).rpc("mark_frame_gift_seen", { p_frame: gift });
    queryClient.setQueryData(["frame-gift", user?.id], null);
  };

  const close = () => { setOpen(false); void markSeen(); };

  // "Załóż" = od razu nosi prezent. Bez tego user musialby sam znalezc arkusz nakladek
  // w Ustawieniach, a prezent, ktory trzeba odszukac, przestaje byc prezentem.
  const wearIt = async () => {
    if (!gift || busy || !user) return;
    setBusy(true);
    haptics.success();
    const { error } = await (supabase as any).from("profiles").update({ avatar_frame: gift }).eq("id", user.id);
    if (error) { haptics.error(); toast.error(t("frames.save_failed")); setBusy(false); return; }
    queryClient.invalidateQueries({ queryKey: ["profile-full", user.id] });
    queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
    queryClient.invalidateQueries({ queryKey: avatarFrameKey(user.id) });
    toast.success(t("frames.saved"));
    setBusy(false);
    close();
  };

  if (!gift) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <SheetContent side="bottom" className="px-6 pt-9 pb-[max(24px,env(safe-area-inset-bottom))] border-0"
        style={{ background: GIFT_BG }}>
        <div className="flex flex-col items-center text-center">
          {/* Sama nakladka jest bohaterem tego ekranu - pokazujemy ja OD RAZU na zdjeciu usera,
              w rozmiarze wiekszym niz gdziekolwiek indziej w apce. */}
          <span className="relative h-[104px] w-[104px]">
            <AvatarFrame kind={isAvatarFrame(gift) ? gift : null} size={104} />
            <Avatar className="h-[104px] w-[104px]">
              <AvatarImage src={avatarSrc(me?.avatar_url ?? null)} className="object-cover bg-orange-100" />
              <AvatarFallback className="bg-orange-100 text-primary text-4xl font-black">
                {(me?.first_name ?? "?").charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </span>

          <SheetTitle className="mt-6 text-[22px] font-black leading-tight" style={{ color: GIFT_INK }}>
            {t("frames.gift_title")}
          </SheetTitle>
          <p className="mt-2 text-[15px] leading-relaxed" style={{ color: GIFT_INK, opacity: 0.85 }}>
            {t("frames.gift_body")}
          </p>

          <button onClick={() => void wearIt()} disabled={busy}
            className="mt-7 w-full rounded-full bg-primary py-3.5 text-[15px] font-bold text-white active:scale-[0.98] transition-transform disabled:opacity-60">
            {t("frames.gift_wear")}
          </button>
          <button onClick={close} className="mt-2 w-full py-3 text-[14px] font-semibold active:opacity-60" style={{ color: GIFT_INK }}>
            {t("frames.gift_later")}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
