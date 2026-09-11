import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { avatarSrc } from "@/lib/avatar";
import { haptics } from "@/hooks/useHaptics";
import { AVATAR_FRAMES, isAvatarFrame, type AvatarFrameId } from "@/lib/avatarFrames";
import AvatarFrame from "@/components/profile/AvatarFrame";

// "Customizuj mój profil" (Ustawienia, prosba Nat 2026-09-11): arkusz z dostepnymi ramkami
// awatara. Kazdy wiersz = podglad NA WLASNYM zdjeciu (user widzi dokladnie to, co zobacza
// inni), nazwa i znacznik wyboru. Tapniecie zapisuje od razu (profiles.avatar_frame) - bez
// osobnego "Zapisz", bo to jedna wartosc i da sie ja w kazdej chwili zmienic.
export default function AvatarFrameSheet({ open, onOpenChange, userId }: { open: boolean; onOpenChange: (v: boolean) => void; userId: string }) {
  const { t } = useTranslation("settings");
  const queryClient = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["avatar-frame-sheet", userId],
    enabled: open && !!userId,
    queryFn: async () => {
      const { data } = await (supabase as any).from("profiles").select("avatar_url, first_name, avatar_frame").eq("id", userId).maybeSingle();
      return data as { avatar_url: string | null; first_name: string | null; avatar_frame: string | null } | null;
    },
  });
  const current: AvatarFrameId | null = isAvatarFrame(me?.avatar_frame) ? me!.avatar_frame : null;

  const choose = async (frame: AvatarFrameId | null) => {
    haptics.selection();
    queryClient.setQueryData(["avatar-frame-sheet", userId], (old: any) => ({ ...(old ?? {}), avatar_frame: frame }));
    const { error } = await (supabase as any).from("profiles").update({ avatar_frame: frame }).eq("id", userId);
    if (error) { toast.error(t("frames.save_failed")); return; }
    // Wszystkie miejsca, ktore czytaja profil, maja zobaczyc nowa ramke od razu.
    queryClient.invalidateQueries({ queryKey: ["profile-full", userId] });
    queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    queryClient.invalidateQueries({ queryKey: ["public-profile"] });
    toast.success(frame ? t("frames.saved") : t("frames.removed"));
  };

  const options: { id: AvatarFrameId | null; label: string }[] = [
    { id: null, label: t("frames.none") },
    ...AVATAR_FRAMES.map((f) => ({ id: f.id as AvatarFrameId | null, label: t(f.labelKey) })),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-5 pt-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        <SheetTitle className="text-lg font-black">{t("frames.title")}</SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{t("frames.desc")}</p>
        <div className="mt-4 divide-y divide-border/40">
          {options.map((o) => {
            const active = current === o.id;
            return (
              <button key={o.id ?? "none"} onClick={() => void choose(o.id)} className="flex w-full items-center gap-4 py-3 text-left active:bg-muted/40 transition-colors">
                <span className="relative h-14 w-14 shrink-0">
                  <AvatarFrame kind={o.id} size={56} />
                  <Avatar className="h-14 w-14">
                    <AvatarImage src={avatarSrc(me?.avatar_url)} className="object-cover bg-orange-100" />
                    <AvatarFallback className="bg-orange-100 text-primary text-xl font-black">{(me?.first_name ?? "?").charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </span>
                <span className="min-w-0 flex-1 text-[15px] font-semibold text-foreground">{o.label}</span>
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${active ? "border-primary bg-primary text-white" : "border-border"}`}>
                  {active && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
