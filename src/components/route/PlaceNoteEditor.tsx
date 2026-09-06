import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil } from "lucide-react";
import { avatarSrc } from "@/lib/avatar";

// Kompaktowy edytor notki miejsca - WSPOLDZIELONY przez listy (SharedList) i wyjazdy (SharedRoute),
// zeby uklad byl spojny (prosba Nat 2026-08-26). Stany:
//  - brak notki, nie edytuje: guzik "+ Dodaj notke" (+ opcjonalny guzik zdjecia obok w photoSlot)
//  - edycja: textarea z AUTO-ZAPISEM (debounce) + "Zapisano" + "Gotowe" (zwija)
//  - notka jest, nie edytuje: sam tekst notki (BEZ headera "Notka") + [Edytuj notke] + photoSlot
// showAvatar/avatarUrl: notka w podgladzie to szary dymek z awatarem autora (prawy-dolny rog) -
// tak samo w wyjazdach i na listach (prosba Nat 2026-08-30). Bez showAvatar zostaje sam tekst.
export default function PlaceNoteEditor({
  note,
  onSave,
  editable = true,
  showAvatar = false,
  avatarUrl,
  photoSlot,
  placeholder,
  onEditingChange,
}: {
  note: string;
  onSave: (value: string) => Promise<void> | void;
  editable?: boolean;
  showAvatar?: boolean;
  avatarUrl?: string | null;
  photoSlot?: React.ReactNode;
  placeholder?: string;
  /** Informuje rodzica, ze user WLASNIE pisze notke - ekran chowa wtedy czat i dolne CTA. */
  onEditingChange?: (editing: boolean) => void;
}) {
  const { t } = useTranslation("route");
  // Domyslka nie moze stac w liscie parametrow - hook nie istnieje jeszcze w tym miejscu.
  const placeholderText = placeholder ?? t("note.placeholder");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const [savedFlash, setSavedFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gdy notka z DB sie zmieni a nie edytujemy - zsynchronizuj draft (np. po refetchu).
  useEffect(() => { if (!editing) setDraft(note ?? ""); }, [note, editing]);
  // Rodzic (widok wyjazdu) chowa czat i dolne guziki na czas pisania - nie zaslaniaja klawiatury
  // ani pola notki (zgloszenie Nat 2026-08-30).
  useEffect(() => { onEditingChange?.(editing); }, [editing, onEditingChange]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const noteText = (note ?? "").trim();

  const flash = () => { setSavedFlash(true); setTimeout(() => setSavedFlash(false), 1500); };
  const scheduleSave = (v: string) => {
    setDraft(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => { await onSave(v.trim()); flash(); }, 700);
  };
  const finish = async () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    await onSave(draft.trim()); // flush ewentualnego niezapisanego stanu
    setEditing(false);
  };
  const startEdit = () => { setDraft(noteText); setEditing(true); };

  if (editing) {
    return (
      <div>
        {/* W trakcie PISANIA nie pokazujemy awatara - autor jest oczywisty, a awatar zabieral
            szerokosc pola i sugerowal, ze notka jest juz opublikowana. */}
        <div className="flex items-start gap-2">
          <div className="relative flex-1 min-w-0">
            <textarea
              value={draft}
              onChange={(e) => scheduleSave(e.target.value)}
              placeholder={placeholderText}
              rows={2}
              autoFocus
              className="w-full bg-muted/50 rounded-xl px-3 py-2.5 text-sm text-foreground resize-none focus:outline-none border border-border/30 placeholder:text-muted-foreground/55"
            />
            {savedFlash && <span className="absolute bottom-2 right-2.5 text-[10px] text-green-600 font-medium">Zapisano</span>}
          </div>
        </div>
        <button onClick={finish} className="mt-1.5 rounded-full bg-secondary text-foreground px-3.5 py-1.5 text-xs font-bold active:scale-95 transition-transform">{t("common:buttons.done")}</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Notka w trybie podgladu. W kontekscie multi-user (wyjazd) wyglada DOKLADNIE tak samo jak
          notki innych uczestnikow ([PlaceNotes]): szary dymek + awatar w prawym-dolnym rogu.
          Wczesniej wlasna notka byla "goly" tekst z awatarem po lewej i lamala spojnosc watku
          (zgloszenie Nat 2026-08-29). */}
      {noteText && (
        showAvatar ? (
          <div className="relative bg-muted/50 rounded-2xl px-3.5 py-2.5 mb-1.5">
            <p className="text-[13.5px] text-foreground/85 leading-snug whitespace-pre-wrap break-words">{noteText}</p>
            <img
              src={avatarSrc(avatarUrl)}
              alt=""
              className="absolute -bottom-1.5 -right-1.5 h-6 w-6 rounded-full object-cover border-2 border-white shadow-sm bg-secondary"
            />
          </div>
        ) : (
          <p className="text-sm text-foreground/90 leading-snug whitespace-pre-wrap break-words">{noteText}</p>
        )
      )}
      {editable && (
        <div className="flex items-center gap-2">
          <button
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-foreground active:scale-95 transition-transform"
          >
            {noteText ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {noteText ? t("note.edit") : t("note.add")}
          </button>
          {photoSlot}
        </div>
      )}
    </div>
  );
}
