import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FramedAvatar } from "@/components/profile/FramedAvatar";
import type { Participant } from "@/components/route/ParticipantsRow";

// Pelna lista uczestnikow wyjazdu / kolekcji - arkusz spod "+N" w gornej belce
// (reguła Nat 2026-09-15: w belce miesci sie autor i najwyzej jedna osoba, reszta tutaj).
//
// ⛔ To jest widok TYLKO DO ODCZYTU. Zarzadzanie skladem kolekcji (dodaj / odbierz dostep)
// zostaje tam, gdzie bylo: menu „…" -> „Osoby w kolekcji" (`CollectionPeopleSheet`), bo to
// akcja wlasciciela, a "+N" tapie kazdy, kto oglada.
export default function PeopleSheet({ open, onOpenChange, title, author, others, leave }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  /** Autor stoi PIERWSZY i bez wyroznienia - kolejnosc niesie role, nie plakietka. */
  author: Participant | null;
  others: Participant[];
  /** Jedyny WYJATEK od "tylko do odczytu" (prosba Nat 2026-09-20): uczestnik kolekcji ma
   *  przy SWOIM wierszu guzik "Opusc". To akcja na sobie, nie na cudzym skladzie - dlatego
   *  moze stac tutaj, a nie w menu wlasciciela. */
  leave?: { userId: string; label: string; onLeave: () => void };
}) {
  const navigate = useNavigate();
  const people = [...(author ? [author] : []), ...others];
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70dvh] overflow-y-auto">
        <SheetHeader><SheetTitle>{title}</SheetTitle></SheetHeader>
        <div className="mt-3 flex flex-col">
          {people.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2.5">
              <button
                onClick={() => { if (p.username) { onOpenChange(false); navigate(`/profil/${p.username}`); } }}
                className="flex min-w-0 flex-1 items-center gap-3 text-left active:opacity-70 transition-opacity"
              >
                <FramedAvatar src={p.avatar_url} frame={p.avatar_frame} color={p.avatar_frame_color} size={40} />
                <span className="truncate text-[15px] font-bold text-foreground">@{p.username ?? "?"}</span>
              </button>
              {leave && p.id === leave.userId && (
                <button
                  type="button"
                  onClick={() => { onOpenChange(false); leave.onLeave(); }}
                  className="shrink-0 rounded-full bg-secondary px-3.5 py-1.5 text-[13px] font-bold text-secondary-foreground active:scale-95 transition-transform"
                >
                  {leave.label}
                </button>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
