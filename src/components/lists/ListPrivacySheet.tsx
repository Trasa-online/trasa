import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Check, Globe2 } from "lucide-react";
import { BrandLock } from "@/components/BrandIcon";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { haptics } from "@/hooks/useHaptics";
import { invalidateContentLists } from "@/lib/trash";

// PRYWATNOSC KOLEKCJI - zmiana przez autora z menu "..." (prosba Nat 2026-09-17).
//
// ⚠️ To jest POWROT opcji zdjetej 2026-08-24 (`ad62204b`, "wszystkie kuratorskie listy
// publiczne - rozwoj bazy discovery"). Baza nigdy nie przestala jej obslugiwac, wiec
// wdrozenie nie wymagalo migracji - sprawdzone na prodzie w `BEGIN … ROLLBACK` na koncie
// NIE-ADMINA (Nat i `99148a59` sa adminami i polityka `discovery_collections_admin_all`
// przepuszcza ich wszedzie, wiec test na ich koncie nic by nie powiedzial):
//   * wlasciciel przelacza `is_public` w obie strony - kolumny nie chroni zaden straznik
//     (`guard_collection_protected_columns` pilnuje tylko licznikow, `user_id` i dat);
//   * po sprywatyzowaniu OBCY nie czyta ani kolekcji, ani jej pozycji, ani skladu (0/0/0);
//   * WLASCICIEL i WSPOLTWORCY czytaja dalej - `can_read_collection` przepuszcza ich
//     niezaleznie od `is_public`;
//   * KTOS, KTO KOLEKCJE ZAPISAL, dostep TRACI. Stad ostrzezenie z liczba osob przy opcji
//     prywatnej: to jedyny skutek zmiany, ktorego user nie zobaczy u siebie na ekranie.
// ⚠️ Moderacja NIE cofa sie do kolejki: zywy `guard_discovery_moderation` zostawia
// `approved`, a `rejected` zostawia `rejected` - czyli przelaczaniem prywatnosci nie da sie
// wyprac decyzji admina. Wersja z migracji `20260822` (public -> `pending`) jest juz
// nieaktualna, nie sugeruj sie plikiem.
//
// ⛔ Arkusz jest TYLKO dla kolekcji kuratorskich (`list_status = 'visited'`). Prywatna
// "Ogolne" (`to_visit`) jest prywatna z definicji i nie ma czego w niej przelaczac.
export default function ListPrivacySheet({ open, onOpenChange, listId, isPublic, savesCount = 0 }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  listId: string;
  isPublic: boolean;
  /** Ile osob ma kolekcje zapisana - wszystkie straca dostep po sprywatyzowaniu. */
  savesCount?: number;
}) {
  const { t } = useTranslation("routelist");
  const queryClient = useQueryClient();

  // Sam zapis, BEZ porownania ze stanem - wola go tez "Cofnij" z toastu, gdzie `isPublic`
  // z domkniecia jest juz nieaktualne.
  const save = async (next: boolean): Promise<boolean> => {
    const { error } = await (supabase as any)
      .from("discovery_collections").update({ is_public: next }).eq("id", listId);
    if (error) { toast.error(t("privacy.save_failed")); return false; }
    queryClient.setQueryData(["shared-list", listId], (old: any) => (old ? { ...old, is_public: next } : old));
    queryClient.invalidateQueries({ queryKey: ["shared-list", listId] });
    // ⚠️ Prywatyzacja zabiera kolekcje z KAZDEJ listy tresci naraz (eksploracja, profile,
    // "Zapisane" u innych, wyszukiwarka), wiec uniewazniamy caly zestaw kluczy jednym
    // wywolaniem - tak samo jak przy usuwaniu. Czyszczenie pojedynczych kluczy bylo zrodlem
    // bledu "usuwam, wracam na profil i nadal to widze" (CLAUDE.md, kosz).
    invalidateContentLists();
    return true;
  };

  const choose = async (next: boolean) => {
    if (next === isPublic) { onOpenChange(false); return; }
    haptics.selection();
    onOpenChange(false);
    if (!(await save(next))) return;
    toast.success(next ? t("privacy.now_public") : t("privacy.now_private"), {
      // Cofniecie jest jednym zapisem w druga strone, wiec nie ma powodu, zeby user szukal
      // arkusza po raz drugi - zwlaszcza gdy dopiero z toastu dowiedzial sie o skutku.
      action: { label: t("privacy.undo"), onClick: () => { void save(!next); } },
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="px-0 pt-6 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="px-5">
          <SheetTitle className="text-lg font-black">{t("privacy.title")}</SheetTitle>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{t("privacy.desc")}</p>
        </div>
        <div className="mt-4 flex flex-col gap-2 px-4">
          <Option
            active={isPublic}
            icon={<Globe2 className="h-[18px] w-[18px]" strokeWidth={2.2} />}
            label={t("privacy.public_label")}
            desc={t("privacy.public_desc")}
            onSelect={() => void choose(true)}
          />
          <Option
            active={!isPublic}
            icon={<BrandLock className="h-[18px] w-[18px]" strokeWidth={2.2} />}
            label={t("privacy.private_label")}
            desc={t("privacy.private_desc")}
            // Ostrzezenie pokazujemy TYLKO gdy zmiana faktycznie komus dostep zabierze,
            // czyli przy kolekcji jeszcze publicznej, ktora ktos ma zapisana.
            warn={isPublic && savesCount > 0 ? t("privacy.private_warn", { count: savesCount }) : null}
            onSelect={() => void choose(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Option({ active, icon, label, desc, warn, onSelect }: {
  active: boolean; icon: ReactNode; label: string; desc: string; warn?: string | null; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      aria-pressed={active}
      className={`flex w-full items-start gap-3 rounded-2xl border px-3.5 py-3.5 text-left transition-colors active:scale-[0.99] ${
        active ? "border-primary/40 bg-[#FCEDE3]" : "border-transparent bg-secondary"
      }`}
    >
      {/* Kolko zawsze biale: przy zaznaczonym wierszu tlo jest peachy, wiec peachy kolko
          zniknieloby, a przy niezaznaczonym szare na szarym. */}
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold text-foreground">{label}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{desc}</span>
        {warn ? <span className="mt-1.5 block text-[13px] font-semibold leading-snug text-foreground">{warn}</span> : null}
      </span>
      {active && <Check className="mt-1.5 h-4 w-4 shrink-0 text-primary" strokeWidth={3} />}
    </button>
  );
}
