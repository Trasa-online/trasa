// SPINNER MARKI: trzy kropki krazace po okregu (prosba Nat 2026-09-17, wzor Pinterest).
// Zastapil trzy kropki skaczace jedna po drugiej (`animate-bounce` z opoznieniem) - tamte
// czytaly sie jak "ktos pisze" w komunikatorze, a nie jak ladowanie ekranu.
//
// ⛔ Zadnych keyframes wlasnych: obraca sie caly kontener przez wbudowane `animate-spin`,
// a kropki stoja nieruchomo w swoich miejscach na okregu. Jedna animacja transformu na
// element zamiast trzech - to jest najtanszy wariant przy przejsciu miedzy ekranami,
// czyli dokladnie w momencie, gdy watek glowny ma najwiecej roboty.
//
// ⚠️ Kropki maja MALEJACE krycie (1 / .55 / .28). Bez tego obracajacy sie rownoboczny
// trojkat kropek wyglada, jakby stal w miejscu - oko nie ma czego sledzic. Gradient krycia
// daje "ogon", ktory czyni obrot czytelnym.
export function BrandSpinner({ size = 32, className = "" }: { size?: number; className?: string }) {
  const dot = Math.round(size * 0.26);
  const radius = (size - dot) / 2;
  return (
    <span
      role="status"
      aria-live="polite"
      className={`relative inline-block animate-spin ${className}`}
      style={{ width: size, height: size, animationDuration: "0.9s" }}
    >
      {[0, 1, 2].map((i) => {
        const angle = (i * 120 * Math.PI) / 180;
        return (
          <span
            key={i}
            className="absolute rounded-full bg-primary"
            style={{
              width: dot,
              height: dot,
              left: `calc(50% + ${Math.sin(angle) * radius}px - ${dot / 2}px)`,
              top: `calc(50% - ${Math.cos(angle) * radius}px - ${dot / 2}px)`,
              opacity: [1, 0.55, 0.28][i],
            }}
          />
        );
      })}
    </span>
  );
}
