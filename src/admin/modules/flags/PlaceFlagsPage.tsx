// Flagi miejsc: zgloszenia userow o problemie z miejscem albo wizytowka.
// Dla zlego zdjecia jest skrot "wyczysc i pobierz ponownie" - bez niego trzeba by
// wchodzic do bazy recznie.
import { Flag, Check, X, RefreshCw } from "lucide-react";
import { Card, Button, StatusBadge, Loading, Spinner, EmptyState } from "../../ui";
import { usePlaceFlags, useResolveFlag, useClearPhotoAndResolve, REASON_LABEL } from "./usePlaceFlags";
import { adminPhotoUrl } from "../places/usePlaces";

export function PlaceFlagsPage() {
  const flags = usePlaceFlags();
  const resolve = useResolveFlag();
  const clearPhoto = useClearPhotoAndResolve();
  const busy = resolve.isPending || clearPhoto.isPending;

  if (flags.isLoading) return <Loading />;
  if (!flags.data?.length) {
    return (
      <Card>
        <EmptyState
          fact="Żadna flaga nie czeka na decyzję."
          next="Zgłoszenia z wizytówek trafiają tu od razu - nic nie trzeba odświeżać."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {flags.data.map((f) => {
        const img = adminPhotoUrl(f.place?.photo_url);
        return (
          <Card key={f.id}>
            <div className="flex items-start gap-3">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--r-control)] bg-[var(--photo)]">
                {img
                  ? <img src={img} alt="" className="h-full w-full object-cover" />
                  : <Flag className="h-5 w-5 text-[var(--stone)]" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-[var(--ink)]">
                  {f.place?.place_name ?? "Miejsce usunięte z bazy"}
                </p>
                <p className="truncate text-[12px] text-[var(--stone)]">
                  {[f.place?.address, f.place?.city].filter(Boolean).join(" · ") || "brak adresu"}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <StatusBadge tone="warn">{REASON_LABEL[f.reason] ?? f.reason}</StatusBadge>
                  <span className="data text-[11px] text-[var(--stone)]">
                    {new Date(f.created_at).toLocaleDateString("pl-PL")}
                  </span>
                </div>
                {f.note ? (
                  <p className="mt-1.5 rounded-[var(--r-control)] bg-[var(--canvas)] px-2.5 py-1.5 text-[12px] text-[var(--graphite)]">
                    „{f.note}”
                  </p>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {f.reason === "bad_photo" ? (
                <Button
                  disabled={busy} onClick={() => clearPhoto.mutate(f)}
                  icon={clearPhoto.isPending ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                >
                  Wyczyść zdjęcie i pobierz ponownie
                </Button>
              ) : null}
              <Button variant="primary" disabled={busy} icon={<Check className="h-4 w-4" />} onClick={() => resolve.mutate({ id: f.id, status: "resolved" })}>
                Rozwiązane
              </Button>
              <Button disabled={busy} icon={<X className="h-4 w-4" />} onClick={() => resolve.mutate({ id: f.id, status: "dismissed" })}>
                Odrzuć
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
