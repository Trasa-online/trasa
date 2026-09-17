import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { X, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import AddPeoplePicker, { type PersonLite } from "@/components/create/AddPeoplePicker";
import { FramedAvatar } from "@/components/profile/FramedAvatar";
import { haptics } from "@/hooks/useHaptics";
import {
  fetchCollectionMembers, inviteUsersToCollection, removeCollectionMember, collectionMembersKey,
} from "@/lib/collectionInvite";

// Wspoltworcy kolekcji - dodawanie i odbieranie dostepu JUZ PO utworzeniu (prosba Nat
// 2026-09-15). Ten sam picker, co w kreatorze (`AddPeoplePicker`: przyjaciele + obserwowani),
// wiec zapraszanie wyglada tak samo przed i po utworzeniu kolekcji.
//
// Dlaczego osobny arkusz, a nie `InviteFriendsSheet` z wyjazdow: tamten jest zwiazany
// z `inviteUsersToRoute` i sesja grupowa. Kolekcja nie ma sesji - czlonkostwo wisi wprost
// na niej - wiec przerabianie tamtego komponentu na dwa byty kosztowaloby wiecej niz ten plik.
export default function CollectionPeopleSheet({ open, onOpenChange, collectionId, ownerId, currentUserId }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  collectionId: string;
  ownerId: string;
  currentUserId: string;
}) {
  const { t } = useTranslation("routelist");
  const queryClient = useQueryClient();
  const isOwner = currentUserId === ownerId;
  const { data: members = [], isLoading } = useQuery({
    queryKey: collectionMembersKey(collectionId),
    enabled: open && !!collectionId,
    queryFn: () => fetchCollectionMembers(collectionId),
    staleTime: 30_000,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: collectionMembersKey(collectionId) });
    // Kolekcja pojawia sie / znika u zaproszonego w "Zapisane" - odswiez tez te liste.
    queryClient.invalidateQueries({ queryKey: ["profile-saved-list-feed"] });
  };

  const selectedIds = new Set(members.map((m) => m.user_id));

  // ⚠️ DODAWANIE MA DWA ETAPY: zaznaczasz kogo chcesz, POTEM zatwierdzasz guzikiem
  // (prosba Nat 2026-09-17). Do tej pory kazde tapniecie w wiersz od razu wysylalo
  // zaproszenie i powiadomienie - czyli nieodwracalna akcja bez chwili na rozmyslenie,
  // a dodanie trzech osob to bylo trzy osobne zapytania i trzy toasty jeden po drugim.
  // Tak samo dziala juz zapraszanie do WYJAZDU (`InviteFriendsSheet`) i kreator - ten
  // arkusz byl jedynym miejscem, ktore robilo to inaczej.
  const [picked, setPicked] = useState<Map<string, PersonLite>>(new Map());
  const [adding, setAdding] = useState(false);

  // Zaznaczenie w pickerze = juz wspoltworzacy (zablokowani) + swiezo wybrani.
  const pickerSelected = new Set<string>([...selectedIds, ...picked.keys()]);

  const togglePick = (person: PersonLite) => {
    haptics.light();
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(person.id)) next.delete(person.id);
      else next.set(person.id, person);
      return next;
    });
  };

  const confirmAdd = async () => {
    if (!isOwner || adding || picked.size === 0) return;
    setAdding(true);
    // JEDNO zapytanie na calą paczkę - `inviteUsersToCollection` przyjmuje liste.
    const res = await inviteUsersToCollection(collectionId, [...picked.keys()], ownerId);
    setAdding(false);
    if (!res.ok) { haptics.error(); toast.error(t("people.add_failed")); return; }
    haptics.success();
    toast.success(t("people.added_count", { count: picked.size }));
    setPicked(new Map());
    refresh();
  };

  // Zamkniecie arkusza porzuca niezatwierdzony wybor - inaczej wrocilby przy nastepnym
  // otwarciu i user zatwierdzilby cos, o czym juz zapomnial.
  useEffect(() => { if (!open) setPicked(new Map()); }, [open]);

  const remove = async (userId: string) => {
    haptics.warning();
    const ok = await removeCollectionMember(collectionId, userId);
    if (!ok) { toast.error(t("people.remove_failed")); return; }
    toast.success(t("people.removed"));
    refresh();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Naglowek i guzik PRZYPIETE, przewija sie sama lista - przy kilkunastu obserwowanych
          guzik na koncu strony oznaczalby przewijanie calej listy po kazdym zaznaczeniu. */}
      <SheetContent side="bottom" className="flex max-h-[88dvh] flex-col overflow-hidden p-0">
        <div className="shrink-0 px-5 pt-6">
          <SheetTitle className="text-lg font-black">{t("people.title")}</SheetTitle>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            {isOwner ? t("people.desc_owner") : t("people.desc_member")}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-2">

        {/* Kto juz wspoltworzy. Wlasciciel moze zabrac dostep; czlonek widzi sam sklad. */}
        {!isLoading && members.length > 0 && (
          <div className="mt-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("people.current")}</p>
            <div className="mt-1.5 divide-y divide-border/40">
              {members.map((m) => (
                <div key={m.user_id} className="flex items-center gap-3 py-2.5">
                  <FramedAvatar src={m.avatar_url} frame={m.avatar_frame} color={m.avatar_frame_color} size={36} />
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">
                    {m.username ? `@${m.username}` : (m.first_name || t("people.user_fallback"))}
                  </span>
                  {isOwner && (
                    <button
                      onClick={() => void remove(m.user_id)}
                      aria-label={t("people.remove")}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground active:scale-90 transition-transform"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {isOwner && (
          <div className="mt-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("people.add")}</p>
            <div className="mt-1">
              <AddPeoplePicker
                userId={currentUserId}
                selected={pickerSelected}
                locked={selectedIds}
                onToggle={togglePick}
              />
            </div>
          </div>
        )}
        </div>

        {/* Guzik pojawia sie DOPIERO po zaznaczeniu kogos - pusty, nieaktywny guzik na dole
            kazdego arkusza tylko zabiera miejsce i uczy, ze nic sie po nim nie dzieje. */}
        {isOwner && picked.size > 0 && (
          <div className="shrink-0 border-t border-border/30 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-3">
            <button
              onClick={() => void confirmAdd()}
              disabled={adding}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[15px] font-bold text-white active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              {adding && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("people.add_confirm", { count: picked.size })}
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
