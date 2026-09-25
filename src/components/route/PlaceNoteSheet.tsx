import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { haptics } from "@/hooks/useHaptics";
import { toast } from "sonner";

// Notka o miejscu w OSOBNYM oknie (prosba Nat 2026-09-10).
//
// Wczesniej akcja z menu otwierala edytor wpisany w wiersz listy - technicznie dzialalo, ale
// pole potrafilo wyladowac poza ekranem albo pod klawiatura, wiec z perspektywy uzywajacego
// "nic sie nie stalo". Osobne okno ma jedna zalete, ktorej tamto nie mialo: zawsze pojawia sie
// tam, gdzie user patrzy, i samo podnosi klawiature.
//
// Zapis do BAZY jest JAWNY (guzik) - w oknie modalnym user oczekuje decyzji „zapisz albo
// anuluj". Ale tekst NIE MOZE przepasc - patrz miekki zapis nizej.

// MIEKKI ZAPIS (zgloszenie testerki 2026-09-25: „rozpisalam sie, wcisnelam zapisz i notatka
// calkowicie zniknela", dwa razy). Trzy drogi utraty tekstu, wszystkie zamkniete:
//  1. Efekt synchronizujacy szkic z baza chodzil na KAZDA zmiane `note` - odswiezenie danych
//     w tle w trakcie pisania nadpisywalo tekst. Teraz szkic startuje TYLKO przy otwarciu.
//  2. Arkusz zamykal sie po „Zapisz" takze wtedy, gdy zapis sie nie udal (caller pokazywal toast
//     albo w ogole nie sprawdzal bledu). Teraz `onSave` oddaje `false` przy porazce, a arkusz
//     zostaje otwarty z tekstem.
//  3. Przypadkowe zamkniecie (gest w dol, tapniecie obok, gdy klawiatura chowa sie pod palcem
//     i guzik ucieka) kasowalo szkic. Szkic zyje w pamieci MODULU pod `draftKey` i wraca przy
//     nastepnym otwarciu. Tapniecie obok przy niezapisanym tekscie w ogole nie zamyka arkusza.
// ⛔ „Anuluj" CZYSCI szkic - to jedyna swiadoma rezygnacja (ta sama zasada co w addPlaceDraft).
// Pamiec modulowa, nie localStorage: szkic ma zyc tyle, co uruchomienie apki.
const drafts = new Map<string, string>();

export default function PlaceNoteSheet({ open, onOpenChange, placeName, note, onSave, placeholder, draftKey }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nazwa miejsca w naglowku - okno ma powiedziec, CZEGO dotyczy notka. */
  placeName: string;
  note: string;
  /** `false` = zapis sie nie udal: arkusz zostaje otwarty, tekst zostaje. */
  onSave: (value: string) => Promise<boolean | void> | boolean | void;
  placeholder?: string;
  /** Klucz szkicu, np. `list:<id>:<miejsce>`. Bez niego - sama nazwa miejsca. */
  draftKey?: string;
}) {
  const { t } = useTranslation("route");
  const key = draftKey ?? `place:${placeName}`;
  const [draft, setDraft] = useState(note ?? "");
  const [saving, setSaving] = useState(false);
  const [restored, setRestored] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const wasOpen = useRef(false);
  const touched = useRef(false);

  // Start szkicu wylacznie na PRZEJSCIU zamkniety -> otwarty. Zapamietany szkic wygrywa z baza.
  useEffect(() => {
    if (open && !wasOpen.current) {
      const kept = drafts.get(key);
      const fromDb = note ?? "";
      const useKept = kept !== undefined && kept.trim() !== fromDb.trim();
      setDraft(useKept ? kept! : fromDb);
      setRestored(useKept);
      touched.current = useKept;
    }
    wasOpen.current = open;
  }, [open, key, note]);
  // Notka z bazy doszla PO otwarciu (zapytanie jeszcze sie ladowalo) - podstaw ja, ale tylko
  // dopoki user nic nie wpisal.
  useEffect(() => {
    if (open && !touched.current) setDraft(note ?? "");
  }, [open, note]);

  const change = (v: string) => {
    touched.current = true;
    setDraft(v);
    drafts.set(key, v);
  };
  const dirty = draft.trim() !== (note ?? "").trim();

  // Pole rosnie do calej tresci, do 45% ekranu - reszta zostaje na klawiature i guziki.
  const autoGrow = () => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, Math.round(window.innerHeight * 0.45))}px`;
  };
  useEffect(() => { if (open) requestAnimationFrame(autoGrow); }, [open, draft]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const ok = await onSave(draft.trim());
      if (ok === false) { haptics.error(); return; }
      drafts.delete(key);
      haptics.success();
      onOpenChange(false);
    } catch (err) {
      console.warn("[PlaceNoteSheet] save:", err);
      haptics.error();
      toast.error(t("note.save_failed"));
    } finally {
      setSaving(false);
    }
  };
  const cancel = () => {
    drafts.delete(key);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))]"
        // Tapniecie obok z niezapisanym tekstem nie zamyka - to najczestszy „wypadek" przy
        // chowajacej sie klawiaturze. Gest w dol dalej zamyka, ale szkic zostaje w pamieci.
        onInteractOutside={(e) => { if (dirty) e.preventDefault(); }}
      >
        <SheetTitle className="text-lg font-black leading-tight pr-8">
          {note?.trim() ? t("note.edit") : t("note.add")}
        </SheetTitle>
        <p className="mt-0.5 text-sm text-muted-foreground truncate">{placeName}</p>
        {restored && <p className="mt-2 text-xs font-semibold text-[#5B2C06]">{t("note.draft_restored")}</p>}
        <textarea
          ref={taRef}
          value={draft}
          onChange={(e) => { change(e.target.value); autoGrow(); }}
          placeholder={placeholder ?? t("note.placeholder")}
          rows={3}
          autoFocus
          className="mt-4 w-full bg-muted/50 rounded-2xl px-3.5 py-3 text-[15px] text-foreground resize-none focus:outline-none border border-border/40 placeholder:text-muted-foreground/55 overflow-y-auto"
        />
        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={cancel}
            className="px-4 h-11 rounded-2xl bg-secondary text-secondary-foreground font-bold text-sm active:scale-[0.98] transition-transform"
          >
            {t("common:buttons.cancel")}
          </button>
          <button
            onClick={() => void save()}
            disabled={saving}
            className="flex-1 h-11 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-50"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {t("common:buttons.save")}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
