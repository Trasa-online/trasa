import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FramedAvatar } from "@/components/profile/FramedAvatar";
import { fetchRouteLikers, routeLikersKey } from "@/lib/routeLikers";

// KTO POLUBIL WYJAZD - arkusz spod serca dla autora i uczestnikow (prosba Nat 2026-09-17).
// Oni polubic nie moga (trigger w bazie), wiec serce jest dla nich licznikiem z wejsciem
// do listy, a nie przelacznikiem. Widok TYLKO DO ODCZYTU, jak `PeopleSheet` - ten sam
// ksztalt wiersza, zeby lista ludzi w apce wygladala wszedzie tak samo.
export default function TripLikesSheet({ open, onOpenChange, routeId }: {
  open: boolean; onOpenChange: (v: boolean) => void; routeId: string;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation("sharing");
  const { data: likers = [], isLoading } = useQuery({
    queryKey: routeLikersKey(routeId),
    // Dociagamy DOPIERO po otwarciu - licznik przy tytule ma juz `routes.likes_count`,
    // wiec lista jest potrzebna tylko temu, kto ja realnie otworzyl.
    enabled: open && !!routeId,
    queryFn: () => fetchRouteLikers(routeId),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70dvh] overflow-y-auto">
        <SheetHeader><SheetTitle>{t("likes.title")}</SheetTitle></SheetHeader>
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">…</p>
        ) : likers.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("likes.empty")}</p>
        ) : (
          <div className="mt-3 flex flex-col">
            {likers.map((p) => (
              <button
                key={p.id}
                onClick={() => { if (p.username) { onOpenChange(false); navigate(`/profil/${p.username}`); } }}
                className="flex items-center gap-3 py-2.5 text-left active:opacity-70 transition-opacity"
              >
                <FramedAvatar src={p.avatar_url} frame={p.avatar_frame} color={p.avatar_frame_color} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-foreground">{p.first_name || p.username}</span>
                  {!!p.username && <span className="block truncate text-[13px] text-muted-foreground">@{p.username}</span>}
                </span>
              </button>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
