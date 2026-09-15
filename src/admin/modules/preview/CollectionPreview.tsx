// Podglad KOLEKCJI tak, jak widzi ja uzytkownik aplikacji: pasek w kolorze kolekcji,
// pigulka autora, chipy, a pod spodem wszystkie miejsca z miniaturami i notkami.
//
// Klikniecie w zdjecie otwiera moderacje pojedynczego zdjecia - podglad jest jednoczesnie
// narzedziem pracy, wiec nie kaze przechodzic gdzie indziej, zeby cos z nim zrobic.
import { useState } from "react";
import { listTheme } from "@/lib/listThemes";
import { Panel, Loading, EmptyState, StatusBadge } from "../../ui";
import { PhotoModerationModal } from "../moderation-b2c/PhotoModerationModal";
import { AuthorPill, OutlineChip, PlaceRow } from "./PreviewParts";
import { useCollectionPreview } from "./usePreviews";

export function CollectionPreview({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading, isError } = useCollectionPreview(id);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const theme = listTheme(data?.theme, id);

  return (
    <>
      <Panel
        wide
        flush
        title="Podgląd kolekcji"
        subtitle="Tak widzi ją użytkownik aplikacji. Kliknięcie w zdjęcie otwiera moderację."
        onClose={onClose}
      >
        {isLoading ? <Loading /> : isError || !data ? (
          <div className="p-5">
            <EmptyState fact="Nie udało się wczytać kolekcji." next="Mogła zostać usunięta przez autora - odśwież listę." />
          </div>
        ) : (
          <>
            {/* Belka w kolorze kolekcji - tym samym, ktory user widzi w eksploracji. */}
            <div className="px-5 py-4" style={{ background: theme.bg }}>
              <div className="flex flex-wrap items-center gap-2">
                <AuthorPill author={data.author} tone="onColor" />
                {data.hidden ? <StatusBadge tone="bad" mono>UKRYTA</StatusBadge> : null}
                {!data.isPublic ? <StatusBadge tone="neutral" mono>PRYWATNA</StatusBadge> : null}
              </div>
              <h2 className="mt-2.5 text-[22px] font-semibold leading-7" style={{ color: theme.ink }}>
                {data.title || "Kolekcja bez tytułu"}
              </h2>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.city ? <OutlineChip onColor={theme.ink === "#FFFFFF"}>{data.city}</OutlineChip> : null}
                {!data.city && data.countries?.length ? <OutlineChip onColor={theme.ink === "#FFFFFF"}>{data.countries.join(" · ")}</OutlineChip> : null}
                <OutlineChip onColor={theme.ink === "#FFFFFF"}>{data.places.length} miejsc</OutlineChip>
              </div>
            </div>

            <div className="px-5 pb-5">
              {data.places.length === 0 ? (
                <EmptyState
                  fact="Ta kolekcja nie ma jeszcze żadnego miejsca."
                  next="Autor ją założył, ale nic nie dodał - w aplikacji wygląda na pustą."
                />
              ) : (
                <ul>
                  {data.places.map((p, i) => (
                    <PlaceRow key={p.key} place={p} index={i + 1} onPhoto={setPhotoUrl} />
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </Panel>
      <PhotoModerationModal url={photoUrl} onClose={() => setPhotoUrl(null)} />
    </>
  );
}
