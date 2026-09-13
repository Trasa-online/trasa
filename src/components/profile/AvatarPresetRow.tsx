import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { haptics } from "@/hooks/useHaptics";
import { AVATAR_PRESET_IDS, presetAvatarUrl } from "@/lib/avatarPresets";

// Rzad awatarow brandowych do wyboru (onboarding, ustawienia): kolka przewijane w poziomie,
// zaznaczony ma obrys i znacznik. Wybor zapisuje rodzic (profiles.avatar_url = pelny URL).
export default function AvatarPresetRow({ value, onPick, disabled, title, desc, flush }: { value: string | null; onPick: (url: string) => void; disabled?: boolean;
  /** Tytul i podpis - onboarding mowi o zdjeciu "pozniej w ustawieniach", arkusz "Customizuj" nie. */
  title?: string; desc?: string;
  /** Arkusz "Customizuj" (px-5, naglowki bez wciecia) - onboarding ma px-4 i naglowki z px-1. */
  flush?: boolean }) {
  const { t } = useTranslation("onboarding");
  const current = value ? value.split("?")[0] : null;
  return (
    <div>
      <p className={`${flush ? "" : "px-1 "}text-sm font-bold text-foreground`}>{title ?? t("photo.presets_title")}</p>
      <p className={`${flush ? "" : "px-1 "}text-xs text-muted-foreground`}>{desc ?? t("photo.presets_desc")}</p>
      <div data-no-swipe data-no-drag className={`${flush ? "-mx-5 px-5" : "-mx-4 px-4"} mt-2.5 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
        {AVATAR_PRESET_IDS.map((id) => {
          const url = presetAvatarUrl(id);
          const active = current === url;
          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => { haptics.selection(); onPick(url); }}
              aria-pressed={active}
              aria-label={t("photo.preset_aria", { id })}
              className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-full transition-transform active:scale-90 disabled:opacity-60 ${active ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}`}
            >
              <img src={url} alt="" className="h-full w-full object-cover" draggable={false} loading="lazy" />
              {active && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                  <Check className="h-5 w-5 text-white drop-shadow" strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
