import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { haptics } from "@/hooks/useHaptics";
import CountryPicker from "@/components/create/CountryPicker";
import { citiesForCountry } from "@/lib/tripCountries";
import { scopeCountries } from "@/lib/tripScope";

// Kraj / miasto kolekcji - zmiana przez autora z menu "..." (prosba Nat 2026-09-14).
// Ten sam CountryPicker, co przy tworzeniu (kraje = zasieg wyszukiwarki miejsc, moze byc kilka),
// plus opcjonalne miasto: chipy miast pierwszego kraju albo wpisane recznie. Miasto pokazuje
// sie w chipie pod nazwa kolekcji i na kafelku w Eksploracji; puste = sam kraj.
export default function ListScopeSheet({ open, onOpenChange, listId, current }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  listId: string;
  current: { city?: string | null; countries?: string[] | null } | null | undefined;
}) {
  const { t } = useTranslation("routelist");
  const queryClient = useQueryClient();
  const [countries, setCountries] = useState<string[]>([]);
  const [city, setCity] = useState("");
  const [saving, setSaving] = useState(false);

  // Stan startowy z kolekcji przy KAZDYM otwarciu - zamkniecie bez zapisu nie zostawia zmian.
  useEffect(() => {
    if (!open) return;
    setCountries(scopeCountries(current));
    setCity(current?.city ?? "");
  }, [open, current]);

  const cityOptions = countries.length ? citiesForCountry(countries[0]) : [];
  const listed = cityOptions.includes(city.trim());

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const next = { countries, city: city.trim() || null };
    const { error } = await (supabase as any).from("discovery_collections").update(next).eq("id", listId);
    setSaving(false);
    if (error) { toast.error(t("scope.save_failed")); return; }
    haptics.success();
    queryClient.setQueryData(["shared-list", listId], (old: any) => (old ? { ...old, ...next } : old));
    queryClient.invalidateQueries({ queryKey: ["shared-list", listId] });
    queryClient.invalidateQueries({ queryKey: ["profile-list-feed"] });
    queryClient.invalidateQueries({ queryKey: ["explore-grid"] });
    toast.success(t("scope.saved"));
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-0 pt-6 pb-0 h-[90dvh] flex flex-col">
        <div className="px-5 shrink-0">
          <SheetTitle className="text-lg font-black">{t("scope.title")}</SheetTitle>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{t("scope.desc")}</p>
        </div>
        <div className="mt-3 flex-1 min-h-0 flex flex-col">
          <CountryPicker selected={countries} onChange={setCountries} />
        </div>
        <div className="shrink-0 border-t border-border/60 px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))]">
          <p className="text-sm font-semibold text-foreground">{t("scope.city_label")}</p>
          {cityOptions.length > 0 && (
            <div data-no-swipe className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={() => { haptics.selection(); setCity(""); }}
                className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold border transition-colors active:scale-[0.97] ${!city.trim() ? "bg-[#FDF184] border-[#FDF184] text-[#5B2C06]" : "bg-white text-foreground border-border"}`}
              >
                {t("scope.no_city")}
              </button>
              {cityOptions.map((c) => {
                const on = city.trim() === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { haptics.selection(); setCity(on ? "" : c); }}
                    className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold border transition-colors active:scale-[0.97] ${on ? "bg-[#FDF184] border-[#FDF184] text-[#5B2C06]" : "bg-white text-foreground border-border"}`}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          )}
          <input
            value={listed ? "" : city}
            onChange={(e) => setCity(e.target.value.slice(0, 60))}
            autoCapitalize="words"
            autoCorrect="off"
            placeholder={listed ? city : t("scope.city_placeholder")}
            className="mt-2 w-full h-11 rounded-xl bg-secondary/60 border border-border/60 px-4 text-[15px] text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-2 focus:ring-orange-500/30"
          />
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="mt-3 w-full h-12 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : t("scope.save")}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
