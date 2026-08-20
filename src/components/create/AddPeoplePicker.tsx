import { useMemo } from "react";
import { Check } from "lucide-react";
import { useFriends } from "@/hooks/useFriends";
import { useFollowList } from "@/hooks/useFollow";
import { avatarSrc } from "@/lib/avatar";

interface Person { id: string; username: string | null; first_name: string | null; avatar_url: string | null }

// Multi-select znajomych do wspoltworzenia wyjazdu. Zrodlo: przyjaciele (symetryczni) +
// obserwowani (following), zdeduplikowani. Sterowany: selected + onToggle.
export default function AddPeoplePicker({
  userId, selected, onToggle,
}: { userId: string; selected: Set<string>; onToggle: (id: string) => void }) {
  const { data: friends = [], isLoading: lf } = useFriends(userId);
  const { data: following = [], isLoading: lg } = useFollowList(userId, "following");

  const people = useMemo<Person[]>(() => {
    const map = new Map<string, Person>();
    for (const p of [...friends, ...following] as Person[]) if (p?.id && !map.has(p.id)) map.set(p.id, p);
    return [...map.values()];
  }, [friends, following]);

  const loading = lf || lg;

  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Ładowanie znajomych...</div>;
  }
  if (!people.length) {
    return (
      <div className="py-10 px-6 text-center">
        <p className="text-sm font-semibold text-foreground">Nie masz jeszcze znajomych</p>
        <p className="mt-1 text-sm text-muted-foreground">{`Dodaj osoby, żeby tworzyć wyjazdy razem z nimi.`}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {people.map((p) => {
        const name = p.username || p.first_name || "Użytkownik";
        const on = selected.has(p.id);
        return (
          <button key={p.id} onClick={() => onToggle(p.id)}
            className="flex items-center gap-3 px-1 py-2.5 text-left active:bg-muted/50 rounded-xl transition-colors">
            <img src={avatarSrc(p.avatar_url)} alt="" className="h-10 w-10 rounded-full object-cover bg-secondary shrink-0" />
            <span className="flex-1 min-w-0 truncate text-[15px] font-semibold text-foreground">{name}</span>
            <span className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${on ? "bg-primary text-white" : "border-2 border-border"}`}>
              {on && <Check className="h-3.5 w-3.5 stroke-[3]" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
