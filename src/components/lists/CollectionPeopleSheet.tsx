import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { X } from "lucide-react";
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

  const toggle = async (person: PersonLite) => {
    if (!isOwner) return;
    haptics.light();
    if (selectedIds.has(person.id)) {
      const ok = await removeCollectionMember(collectionId, person.id);
      if (!ok) { toast.error(t("people.remove_failed")); return; }
      toast.success(t("people.removed"));
    } else {
      const res = await inviteUsersToCollection(collectionId, [person.id], ownerId);
      if (!res.ok) { toast.error(t("people.add_failed")); return; }
      toast.success(t("people.added"));
    }
    refresh();
  };

  const remove = async (userId: string) => {
    haptics.warning();
    const ok = await removeCollectionMember(collectionId, userId);
    if (!ok) { toast.error(t("people.remove_failed")); return; }
    toast.success(t("people.removed"));
    refresh();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl px-5 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] max-h-[88dvh] overflow-y-auto">
        <SheetTitle className="text-lg font-black">{t("people.title")}</SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          {isOwner ? t("people.desc_owner") : t("people.desc_member")}
        </p>

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
              <AddPeoplePicker userId={currentUserId} selected={selectedIds} onToggle={(p) => void toggle(p)} />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
