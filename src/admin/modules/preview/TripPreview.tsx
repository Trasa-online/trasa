// Podglad WYJAZDU tak, jak widzi go uzytkownik aplikacji: okladka, autor, chipy,
// opis wlasciciela, notki uczestnikow, a nizej miejsca PO DNIACH ze zdjeciami i notkami.
//
// Wyjazd bez podzialu na dni renderuje sie jako jedna lista - w apce jest tak samo,
// naglowki dni pojawiaja sie dopiero, gdy ktos je ustawi.
import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ImageOff } from "lucide-react";
import { Panel, Loading, EmptyState, StatusBadge } from "../../ui";
import { PhotoModerationModal } from "../moderation-b2c/PhotoModerationModal";
import { AuthorPill, OutlineChip, NoteBubble, PlaceRow, previewPhoto } from "./PreviewParts";
import { useTripPreview, type PreviewPlace } from "./usePreviews";

const day = (iso: string | null) => { try { return iso ? format(parseISO(iso), "d.MM.yyyy") : null; } catch { return null; } };

export function TripPreview({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading, isError } = useTripPreview(id);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Grupowanie po dniu w kolejnosci, w jakiej dni wystepuja - bez tego wyjazd
  // z dniami 1,3 pokazalby pusty "Dzien 2".
  const groups = useMemo(() => {
    if (!data) return [];
    if (!data.hasDays) return [{ dayIndex: null as number | null, places: data.places }];
    const map = new Map<number, PreviewPlace[]>();
    for (const p of data.places) {
      const k = p.dayIndex ?? 0;
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(p);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([dayIndex, places]) => ({ dayIndex, places }));
  }, [data]);

  const cover = previewPhoto(data?.coverUrl, 400);
  const dates = [day(data?.startDate ?? null), day(data?.endDate ?? null)].filter(Boolean).join(" - ");

  return (
    <>
      <Panel
        wide
        title="Podgląd wyjazdu"
        subtitle="Tak widzi go użytkownik aplikacji. Kliknięcie w zdjęcie otwiera moderację."
        onClose={onClose}
      >
        {isLoading ? <Loading /> : isError || !data ? (
          <EmptyState fact="Nie udało się wczytać wyjazdu." next="Mógł zostać usunięty przez autora - odśwież listę." />
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex gap-4">
              {/* Okladka wyjazdu jest PIONOWA (3:4 albo 9:16) - patrz CLAUDE.md. */}
              <span className="flex h-[168px] w-[126px] shrink-0 items-center justify-center overflow-hidden rounded-[var(--r-card)] bg-[var(--photo)]">
                {cover
                  ? <img src={cover} alt="" className="h-full w-full object-cover" />
                  : <ImageOff className="h-5 w-5 text-[var(--stone)]" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <AuthorPill author={data.author} />
                  {data.hidden ? <StatusBadge tone="bad" mono>UKRYTY</StatusBadge> : null}
                </div>
                <h2 className="mt-2 text-[22px] font-semibold leading-7 text-[var(--ink)]">
                  {data.title || "Wyjazd bez nazwy"}
                </h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {data.city ? <OutlineChip>{data.city}</OutlineChip> : null}
                  {!data.city && data.countries?.length ? <OutlineChip>{data.countries.join(" · ")}</OutlineChip> : null}
                  <OutlineChip>{data.places.length} miejsc</OutlineChip>
                  {dates ? <OutlineChip>{dates}</OutlineChip> : null}
                </div>
              </div>
            </div>

            {data.description ? (
              <p className="text-[14px] leading-6 text-[var(--graphite)]">{data.description}</p>
            ) : null}

            {data.memberNotes.length ? (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.8px] text-[var(--stone)]">Od uczestników</p>
                {data.memberNotes.map((n, i) => <NoteBubble key={i} text={n.text} author={n.author} />)}
              </div>
            ) : null}

            {data.places.length === 0 ? (
              <EmptyState
                fact="Ten wyjazd nie ma żadnego miejsca."
                next="Został opublikowany pusty - w eksploracji widać samą okładkę."
              />
            ) : groups.map((g) => (
              <section key={String(g.dayIndex)}>
                {g.dayIndex != null ? (
                  <p className="sticky top-0 z-10 bg-[var(--surface)] py-1.5 text-[10px] font-semibold uppercase tracking-[0.8px] text-[var(--stone)]">
                    Dzień {g.dayIndex + 1}
                  </p>
                ) : null}
                <ul>
                  {g.places.map((p, i) => <PlaceRow key={p.key} place={p} index={i + 1} onPhoto={setPhotoUrl} />)}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Panel>
      <PhotoModerationModal url={photoUrl} onClose={() => setPhotoUrl(null)} />
    </>
  );
}
