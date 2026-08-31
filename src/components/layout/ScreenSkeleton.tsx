// Szkielety ekranow ("widok ladowania") - zamiast pustego ekranu z samym spinnerem.
// Uzywane w dwoch miejscach:
//  1. Suspense fallback w App.tsx - przejscie MIEDZY ekranami (lazy chunk),
//  2. lokalne stany `isLoading` ekranow, ktore czekaja na dane z Supabase.
// Wariant dobieramy do ekranu docelowego, zeby uklad "nie skakal" po zaladowaniu.
// Zasady: tylko bloki `bg-muted` + `animate-pulse`, zero tekstu i zero ikon - szkielet ma
// sugerowac uklad, nie udawac tresci (prosba Nat 2026-08-31: "miedzy widokami jest zbyt pusto").

export type SkeletonVariant = "feed" | "profile" | "trip" | "list" | "generic";

const Block = ({ className }: { className: string }) => (
  <div className={`bg-muted rounded-2xl ${className}`} />
);

// Pasek gorny (topbar) - wspolny dla wiekszosci ekranow.
const TopBar = () => (
  <div className="flex items-center justify-between gap-3 px-5 pt-[max(16px,env(safe-area-inset-top,0px))] pb-3">
    <Block className="h-10 w-32 rounded-full" />
    <div className="flex items-center gap-2">
      <Block className="h-10 w-10 rounded-full" />
      <Block className="h-10 w-10 rounded-full" />
    </div>
  </div>
);

function FeedSkeleton() {
  return (
    <>
      <TopBar />
      <div className="px-4">
        {/* Pelnoekranowa karta trasy (TrasaBigCard) - jeden ekran = jedna karta. */}
        <div className="w-full aspect-[3/4] rounded-3xl bg-muted overflow-hidden relative">
          <div className="absolute left-5 right-5 bottom-6 space-y-2.5">
            <div className="h-4 w-40 rounded-full bg-background/40" />
            <div className="h-7 w-56 rounded-full bg-background/40" />
            <div className="h-4 w-32 rounded-full bg-background/30" />
          </div>
        </div>
      </div>
    </>
  );
}

function ProfileSkeleton() {
  return (
    <>
      <TopBar />
      <div className="px-5 space-y-6">
        <div className="flex items-center gap-4">
          <Block className="h-20 w-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Block className="h-5 w-32" />
            <Block className="h-4 w-24" />
            <Block className="h-4 w-40" />
          </div>
        </div>
        {/* Pigulki zakladek */}
        <div className="flex gap-2">
          <Block className="h-9 w-28 rounded-full" />
          <Block className="h-9 w-24 rounded-full" />
        </div>
        <Block className="w-full aspect-[3/4] rounded-3xl" />
      </div>
    </>
  );
}

function TripSkeleton() {
  return (
    <>
      {/* Hero wyjazdu */}
      <Block className="w-full aspect-[4/3] rounded-none" />
      <div className="px-5 pt-5 space-y-5">
        <div className="space-y-2.5">
          <Block className="h-7 w-52" />
          <Block className="h-4 w-36" />
          <Block className="h-4 w-full" />
          <Block className="h-4 w-2/3" />
        </div>
        {/* Zakladki Miejsca / Galeria / Mapa */}
        <div className="flex gap-6">
          <Block className="h-8 w-8 rounded-full" />
          <Block className="h-8 w-8 rounded-full" />
          <Block className="h-8 w-8 rounded-full" />
        </div>
        {/* Wiersze miejsc */}
        <div className="space-y-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Block className="h-[72px] w-[72px] shrink-0" />
              <div className="flex-1 space-y-2">
                <Block className="h-4 w-2/3" />
                <Block className="h-3.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function ListSkeleton() {
  return (
    <>
      <TopBar />
      <div className="px-5 space-y-5">
        <div className="space-y-2.5">
          <Block className="h-7 w-48" />
          <Block className="h-4 w-32" />
        </div>
        <div className="space-y-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Block className="h-[72px] w-[72px] shrink-0" />
              <div className="flex-1 space-y-2">
                <Block className="h-4 w-3/5" />
                <Block className="h-3.5 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function GenericSkeleton() {
  return (
    <>
      <TopBar />
      <div className="px-5 space-y-4">
        <Block className="h-7 w-44" />
        <Block className="h-4 w-full" />
        <Block className="h-4 w-3/4" />
        <Block className="h-44 w-full rounded-3xl" />
        <Block className="h-4 w-2/3" />
        <Block className="h-4 w-1/2" />
      </div>
    </>
  );
}

export default function ScreenSkeleton({ variant = "generic", className = "" }: {
  variant?: SkeletonVariant;
  className?: string;
}) {
  return (
    <div aria-hidden aria-busy className={`min-h-[100dvh] bg-background animate-pulse ${className}`}>
      {variant === "feed" && <FeedSkeleton />}
      {variant === "profile" && <ProfileSkeleton />}
      {variant === "trip" && <TripSkeleton />}
      {variant === "list" && <ListSkeleton />}
      {variant === "generic" && <GenericSkeleton />}
    </div>
  );
}

// Wariant dobrany do ADRESU, na ktory wlasnie idziemy - uzywane w globalnym Suspense
// fallbacku (tam nie znamy jeszcze komponentu ekranu). HashRouter: sciezka po "#".
export function variantForPath(hash: string): SkeletonVariant {
  const path = (hash.split("?")[0] || "").replace(/^#/, "");
  if (path.startsWith("/eksploruj") || path.startsWith("/home") || path === "/" || path.startsWith("/plan")) return "feed";
  if (path.startsWith("/moj-profil") || path.startsWith("/profil")) return "profile";
  if (path.startsWith("/route") || path.startsWith("/review-summary") || path.startsWith("/wyjazd")) return "trip";
  if (path.startsWith("/lista") || path.startsWith("/utworz") || path.startsWith("/zapisane")) return "list";
  return "generic";
}
