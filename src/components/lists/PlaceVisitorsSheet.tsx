import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CheckCheck } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { FramedAvatar } from "@/components/profile/FramedAvatar";
import { BrandIcon, STAR_ICON } from "@/components/BrandIcon";

type Person = { id: string; username: string | null; avatar_url: string | null; avatar_frame?: string | null; avatar_frame_color?: string | null };

// Arkusz spod zoltej pigulki "odwiedzone" przy miejscu w kolekcji (prosba Nat 2026-09-20):
// kto tu byl i kto zostawil gwiazdke. Jedna lista, dwie plakietki - osoba, ktora wyroznila
// bez odhaczenia, tez tu stoi (inaczej gwiazdka przy nazwie nie mialaby wyjasnienia).
// Odwiedzajacy najpierw, w kolejnosci uczestnikow; tap w osobe = jej profil.
export default function PlaceVisitorsSheet({ open, onOpenChange, placeName, visitorIds, starredIds, people }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  placeName: string;
  visitorIds: string[];
  starredIds: string[];
  people: Map<string, Person>;
}) {
  const { t } = useTranslation("routelist");
  const navigate = useNavigate();
  const visited = new Set(visitorIds);
  const starred = new Set(starredIds);
  const ids = [...visitorIds, ...starredIds.filter((id) => !visited.has(id))];
  const rows = ids.map((id) => people.get(id) ?? { id, username: null, avatar_url: null });
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[70dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("visitors.title")}</SheetTitle>
          <p className="truncate text-[14px] text-muted-foreground">{placeName}</p>
        </SheetHeader>
        <div className="mt-3 flex flex-col">
          {rows.length === 0 && <p className="py-4 text-[14px] text-muted-foreground">{t("visitors.empty")}</p>}
          {rows.map((p) => (
            <button
              key={p.id}
              onClick={() => { if (p.username) { onOpenChange(false); navigate(`/profil/${p.username}`); } }}
              className="flex items-center gap-3 py-2.5 text-left active:opacity-70 transition-opacity"
            >
              <FramedAvatar src={p.avatar_url} frame={p.avatar_frame} color={p.avatar_frame_color} size={40} />
              <span className="min-w-0 flex-1 truncate text-[15px] font-bold text-foreground">@{p.username ?? "?"}</span>
              {visited.has(p.id) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#FDF184] px-2.5 py-1 text-[12px] font-bold text-[#5B2C06]">
                  <CheckCheck className="h-3.5 w-3.5" strokeWidth={3} />{t("visitors.visited")}
                </span>
              )}
              {starred.has(p.id) && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#fcede3] px-2.5 py-1 text-[12px] font-bold text-[#5B2C06]">
                  <BrandIcon src={STAR_ICON} className="h-3.5 w-3.5 text-primary" />{t("visitors.starred")}
                </span>
              )}
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
