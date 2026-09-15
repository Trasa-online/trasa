// Paginacja kropkowa dla podgladow pelnoekranowych (galeria wyjazdu, zdjecia miejsc).
// Zastapila strzalki "poprzednie/nastepne" (prosba Nat 2026-08-30) - kropki sugeruja,
// ze zdjecia przewija sie gestem, i nie zaslaniaja samego zdjecia.
// Przy duzej liczbie zdjec pokazujemy okno max 7 kropek + licznik, zeby pasek nie rosl w nieskonczonosc.
const MAX_DOTS = 7;

export default function PhotoPagination({ count, index, className = "" }: {
  count: number;
  index: number;
  className?: string;
}) {
  if (count < 2) return null;
  const windowed = count > MAX_DOTS;
  const start = windowed ? Math.min(Math.max(0, index - Math.floor(MAX_DOTS / 2)), count - MAX_DOTS) : 0;
  const dots = Array.from({ length: windowed ? MAX_DOTS : count }, (_, i) => start + i);

  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pointer-events-none ${className}`}
      style={{ bottom: "max(24px, calc(env(safe-area-inset-bottom, 0px) + 16px))" }}
    >
      <div className="flex items-center gap-1.5">
        {dots.map((i) => (
          <span
            key={i}
            className={`rounded-full transition-all duration-200 ${i === index ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/40"}`}
          />
        ))}
      </div>
      {windowed && <span className="text-white/70 text-[11px] font-medium">{index + 1} / {count}</span>}
    </div>
  );
}
