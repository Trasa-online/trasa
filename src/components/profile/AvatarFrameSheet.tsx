import { useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Lock, Pipette } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { avatarSrc } from "@/lib/avatar";
import { haptics } from "@/hooks/useHaptics";
import { AVATAR_FRAMES, DEFAULT_FRAME_COLOR, FRAME_SWATCHES, isAvatarFrame, isFrameColor, type AvatarFrameId } from "@/lib/avatarFrames";
import AvatarFrame from "@/components/profile/AvatarFrame";

// "Customizuj mój profil" (prosba Nat 2026-09-11): arkusz z ramkami awatara i ich kolorem.
// Kazdy wiersz = podglad NA WLASNYM zdjeciu (user widzi dokladnie to, co zobacza inni),
// nazwa i znacznik wyboru. Kolor: szybkie kolory + pipeta (systemowa paleta - dowolny kolor).
// Tapniecie zapisuje od razu (profiles.avatar_frame / avatar_frame_color) - bez osobnego
// "Zapisz", bo to dwie wartosci i da sie je w kazdej chwili zmienic.
type Me = { avatar_url: string | null; first_name: string | null; avatar_frame: string | null; avatar_frame_color: string | null };

export function useMyAvatarFrame(userId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["avatar-frame-sheet", userId],
    enabled: enabled && !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("profiles").select("avatar_url, first_name, avatar_frame, avatar_frame_color").eq("id", userId!).maybeSingle();
      return (data ?? null) as Me | null;
    },
  });
}

export default function AvatarFrameSheet({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (v: boolean) => void; userId: string }) {
  const { t } = useTranslation("settings");
  const queryClient = useQueryClient();
  const { data: me } = useMyAvatarFrame(userId, open);
  const navigate = useNavigate();
  const colorInput = useRef<HTMLInputElement>(null);
  // Ktore nakladki sa odblokowane (nagroda za zaproszenia) - liczy baza, UI tylko pokazuje.
  const { data: unlocks } = useQuery({
    queryKey: ["frame-unlocks", userId],
    enabled: open && !!userId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("my_frame_unlocks");
      if (error) throw error;
      return (data ?? []) as { frame: string; unlocked: boolean; invited: number; goal: number }[];
    },
  });
  const unlockOf = (id: AvatarFrameId | null) => (id ? unlocks?.find((u) => u.frame === id) : undefined);
  const isLocked = (id: AvatarFrameId | null) => !!id && unlocks !== undefined && unlockOf(id)?.unlocked === false;
  const current: AvatarFrameId | null = isAvatarFrame(me?.avatar_frame) ? me!.avatar_frame : null;
  const color = isFrameColor(me?.avatar_frame_color) ? me!.avatar_frame_color! : DEFAULT_FRAME_COLOR;
  const customColor = !FRAME_SWATCHES.includes(color);

  const invalidateAll = () => {
    // Wszystkie miejsca, ktore czytaja profil, maja zobaczyc zmiane od razu.
    queryClient.invalidateQueries({ queryKey: ["profile-full", userId] });
    queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    queryClient.invalidateQueries({ queryKey: ["public-profile"] });
  };
  const chooseFrame = async (frame: AvatarFrameId | null) => {
    if (isLocked(frame)) {
      // Zablokowana nagroda: powiedz, ile brakuje, i zaprowadz do zaproszen (karta na profilu).
      haptics.error();
      const u = unlockOf(frame);
      toast(t("frames.locked_toast", { left: Math.max(0, (u?.goal ?? 3) - (u?.invited ?? 0)) }), {
        action: { label: t("frames.locked_cta"), onClick: () => { onOpenChange(false); navigate("/moj-profil"); } },
      });
      return;
    }
    haptics.selection();
    queryClient.setQueryData(["avatar-frame-sheet", userId], (old: any) => ({ ...(old ?? {}), avatar_frame: frame }));
    const { error } = await (supabase as any).from("profiles").update({ avatar_frame: frame }).eq("id", userId);
    if (error) {
      // Baza odrzuca zablokowana nakladke (trigger) - nawet gdyby UI sie pomylil.
      queryClient.invalidateQueries({ queryKey: ["avatar-frame-sheet", userId] });
      toast.error(String(error.message).includes("frame_locked") ? t("frames.locked_error") : t("frames.save_failed"));
      return;
    }
    invalidateAll();
    toast.success(frame ? t("frames.saved") : t("frames.removed"));
  };
  const chooseColor = async (hex: string) => {
    if (!isFrameColor(hex)) return;
    haptics.selection();
    // Pomarancz marki = brak nadpisania (null), zeby "domyslny" znaczyl to samo dla wszystkich.
    const value = hex.toUpperCase() === DEFAULT_FRAME_COLOR ? null : hex.toUpperCase();
    queryClient.setQueryData(["avatar-frame-sheet", userId], (old: any) => ({ ...(old ?? {}), avatar_frame_color: value }));
    const { error } = await (supabase as any).from("profiles").update({ avatar_frame_color: value }).eq("id", userId);
    if (error) { toast.error(t("frames.save_failed")); return; }
    invalidateAll();
  };

  const options: { id: AvatarFrameId | null; label: string; reward?: boolean }[] = [
    { id: null, label: t("frames.none") },
    ...AVATAR_FRAMES.map((f) => ({ id: f.id as AvatarFrameId | null, label: t(f.labelKey), reward: f.reward })),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-5 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] max-h-[88dvh] overflow-y-auto">
        <SheetTitle className="text-lg font-black">{t("frames.title")}</SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{t("frames.desc")}</p>

        <div className="mt-4 divide-y divide-border/40">
          {options.map((o) => {
            const active = current === o.id;
            const locked = isLocked(o.id);
            const u = unlockOf(o.id);
            return (
              <button key={o.id ?? "none"} onClick={() => void chooseFrame(o.id)} aria-disabled={locked} className="flex w-full items-center gap-4 py-3 text-left active:bg-muted/40 transition-colors">
                <span className={`relative h-14 w-14 shrink-0 ${locked ? "opacity-60 grayscale-[0.3]" : ""}`}>
                  <AvatarFrame kind={o.id} color={color} size={56} />
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={avatarSrc(me?.avatar_url)} className="object-cover bg-orange-100" />
                    <AvatarFallback className="bg-orange-100 text-primary text-xl font-black">{(me?.first_name ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                    {o.label}
                    {o.reward && <span className="rounded-full bg-[#FDF184] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#5B2C06]">{t("frames.reward")}</span>}
                  </span>
                  {o.reward && u && (
                    <span className="block text-[12px] text-muted-foreground">
                      {locked ? t("frames.locked_hint", { invited: u.invited, goal: u.goal }) : t("frames.unlocked_hint")}
                    </span>
                  )}
                </span>
                {locked ? (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary"><Lock className="h-3.5 w-3.5 text-muted-foreground" /></span>
                ) : (
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${active ? "border-primary bg-primary text-white" : "border-border"}`}>
                    {active && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Kolor nakladki: szybkie kolory + pipeta (systemowa paleta, dowolny kolor). */}
        <p className="mt-5 text-sm font-bold text-foreground">{t("frames.color")}</p>
        <p className="text-xs text-muted-foreground">{t("frames.color_desc")}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          {FRAME_SWATCHES.map((hex) => {
            const active = color.toUpperCase() === hex.toUpperCase();
            return (
              <button
                key={hex}
                onClick={() => void chooseColor(hex)}
                aria-label={hex === DEFAULT_FRAME_COLOR ? t("frames.color_default") : hex}
                aria-pressed={active}
                className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-transform active:scale-90 ${active ? "border-foreground" : "border-transparent"}`}
                style={{ backgroundColor: hex }}
              >
                {active && <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3} />}
              </button>
            );
          })}
          <button
            onClick={() => colorInput.current?.click()}
            aria-label={t("frames.color_custom")}
            aria-pressed={customColor}
            className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 ${customColor ? "border-foreground" : "border-border"} bg-[conic-gradient(from_0deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)] active:scale-90 transition-transform`}
          >
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90">
              <Pipette className="h-3.5 w-3.5 text-foreground" />
            </span>
            {/* Natywny selektor koloru (iOS pokazuje systemowa palete) - ukryty, odpalany guzikiem. */}
            <input ref={colorInput} type="color" value={color} onChange={(e) => void chooseColor(e.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-hidden tabIndex={-1} />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
