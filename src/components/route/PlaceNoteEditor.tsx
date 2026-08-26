import { useEffect, useRef, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import { avatarSrc } from "@/lib/avatar";

// Kompaktowy edytor notki miejsca - WSPOLDZIELONY przez listy (SharedList) i wyjazdy (SharedRoute),
// zeby uklad byl spojny (prosba Nat 2026-08-26). Stany:
//  - brak notki, nie edytuje: guzik "+ Dodaj notke" (+ opcjonalny guzik zdjecia obok w photoSlot)
//  - edycja: textarea z AUTO-ZAPISEM (debounce) + "Zapisano" + "Gotowe" (zwija)
//  - notka jest, nie edytuje: sam tekst notki (BEZ headera "Notka") + [Edytuj notke] + photoSlot
// showAvatar/avatarUrl: multi-user (wyjazdy) pokazuja awatar autora obok notki; listy = bez awatara.
export default function PlaceNoteEditor({
  note,
  onSave,
  editable = true,
  showAvatar = false,
  avatarUrl,
  photoSlot,
  placeholder = "Dodaj notkę o tym miejscu...",
}: {
  note: string;
  onSave: (value: string) => Promise<void> | void;
  editable?: boolean;
  showAvatar?: boolean;
  avatarUrl?: string | null;
  photoSlot?: React.ReactNode;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const [savedFlash, setSavedFlash] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gdy notka z DB sie zmieni a nie edytujemy - zsynchronizuj draft (np. po refetchu).
  useEffect(() => { if (!editing) setDraft(note ?? ""); }, [note, editing]);
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
        <div className="flex items-start gap-2">
          {showAvatar && <img src={avatarSrc(avatarUrl)} alt="" className="h-7 w-7 rounded-full object-cover bg-secondary shrink-0 mt-0.5" />}
          <div className="relative flex-1 min-w-0">
            <textarea
              value={draft}
              onChange={(e) => scheduleSave(e.target.value)}
              placeholder={placeholder}
              rows={2}
              autoFocus
              className="w-full bg-muted/50 rounded-xl px-3 py-2.5 text-sm text-foreground resize-none focus:outline-none border border-border/30 placeholder:text-muted-foreground/55"
            />
            {savedFlash && <span className="absolute bottom-2 right-2.5 text-[10px] text-green-600 font-medium">Zapisano</span>}
          </div>
        </div>
        <button onClick={finish} className="mt-1.5 rounded-full bg-secondary text-foreground px-3.5 py-1.5 text-xs font-bold active:scale-95 transition-transform">Gotowe</button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Notka (bez headera) - awatar + tekst gdy multi-user, sam tekst na liscie. */}
      {noteText && (
        <div className="flex items-start gap-2">
          {showAvatar && <img src={avatarSrc(avatarUrl)} alt="" className="h-7 w-7 rounded-full object-cover bg-secondary shrink-0 mt-0.5" />}
          <p className="flex-1 min-w-0 text-sm text-foreground/90 leading-snug whitespace-pre-wrap break-words">{noteText}</p>
        </div>
      )}
      {editable && (
        <div className="flex items-center gap-2">
          <button
            onClick={startEdit}
            className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-foreground active:scale-95 transition-transform"
          >
            {noteText ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {noteText ? "Edytuj notkę" : "Dodaj notkę"}
          </button>
          {photoSlot}
        </div>
      )}
    </div>
  );
}
