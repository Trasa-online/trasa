import { BrandSpinner } from "@/components/BrandSpinner";

// SZKIELET KARTY MIEJSCA (prosba Nat 2026-09-23: "czasami ladowanie tej zakladki trwa bardzo
// dlugo - dodaj skeleton, procz kręcących kropek").
//
// ⚠️ Szkielet ma DOKLADNIE te sama geometrie, co prawdziwa karta - ta sama wysokosc wiersza
// i ten sam `px-4`. Inaczej po doczytaniu danych tresc podskakuje, a to wyglada gorzej niz
// samo czekanie. Wymiary skopiowane z listy kart w `PlaceSwiper` (scrollMode) i z pudelka
// 9:16 (tryb stosu) - ⛔ zmieniasz tam geometrie, zmien i tutaj.
//
// Kropki zostaja (Nat: "procz kręcących kropek"), ale siedza NA szkielecie, nie zamiast niego:
// szkielet mowi CO sie laduje, kropki - ze cos sie dzieje.

const SHIMMER = "animate-pulse bg-muted";

function CardBody({ spinner = false }: { spinner?: boolean }) {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-3xl bg-muted/70">
      {/* plakietka kategorii */}
      <div className={`absolute left-4 top-4 h-7 w-24 rounded-full ${SHIMMER}`} />
      {/* kolumna akcji po prawej (zapisz / rozwin) */}
      <div className="absolute right-4 top-4 flex flex-col gap-2.5">
        <div className={`h-10 w-10 rounded-full ${SHIMMER}`} />
        <div className={`h-10 w-10 rounded-full ${SHIMMER}`} />
      </div>
      {/* nazwa + adres u dolu, tam gdzie na karcie */}
      <div className="absolute inset-x-4 bottom-5 space-y-2.5">
        <div className={`h-7 w-3/4 rounded-xl ${SHIMMER}`} />
        <div className={`h-4 w-1/2 rounded-lg ${SHIMMER}`} />
      </div>
      {/* Kropki TYLKO na pierwszej karcie - na skrawku nastepnej wygladaly jak drugi,
          niezalezny loader wystajacy zza dolnego paska. */}
      {spinner && (
        <div className="absolute inset-0 flex items-center justify-center">
          <BrandSpinner size={30} />
        </div>
      )}
    </div>
  );
}

/** Lista kart (zakladka "Miejsca"): pierwsza karta + skrawek nastepnej, jak w prawdziwym widoku. */
export function PlaceCardSkeletonList() {
  return (
    <div className="flex-1 min-h-0 overflow-hidden" aria-busy="true">
      <div className="w-full flex flex-col px-4 mb-4 h-[calc(100dvh-150px-env(safe-area-inset-top,0px)-max(16px,env(safe-area-inset-bottom,0px)))]">
        <div className="relative flex-1 min-h-0 w-full"><CardBody spinner /></div>
      </div>
      {/* Skrawek nastepnej karty - ta sama afordancja "scrolluj dalej", co w prawdziwej liscie. */}
      <div className="w-full px-4 h-24 opacity-60"><CardBody /></div>
    </div>
  );
}

/** Pojedyncza karta 9:16 (tryb stosu w kreatorze planu). */
export function PlaceCardSkeletonStack({ exploreMode }: { exploreMode?: boolean }) {
  return (
    <div className="flex-1 min-h-0 flex items-center justify-center w-full" aria-busy="true">
      <div
        className="relative aspect-[9/16]"
        style={{
          width: exploreMode
            ? "min(460px, calc(100vw - 32px), calc((100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 88px) * 9 / 16))"
            : "min(420px, calc(100vw - 48px), calc((100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 242px) * 9 / 16))",
        }}
      >
        <CardBody spinner />
      </div>
    </div>
  );
}
