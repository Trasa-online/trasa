import { BrandIcon, STAR_ICON } from "@/components/BrandIcon";

// PROBA ramki awatara (prosba Nat 2026-09-11): cztery brandowe gwiazdki krazace wokol
// awatara w petli. Ramka jest NAKLADKA - nie dotyka samego awatara ani jego przycisku zmiany
// zdjecia (pointer-events-none), wiec da sie ja wlaczyc/wylaczyc jedna linia.
//
// Ruch: pierscien obraca sie 14 s na obrot (CSS animation, GPU), kazda gwiazdka dodatkowo
// obraca sie w przeciwna strone z ta sama predkoscia, dzieki czemu NIE fika koziolkow -
// zawsze stoi "prosto", tylko wedruje po okregu. `motion-reduce` zatrzymuje ruch: gwiazdki
// zostaja jako statyczna ozdoba (dostepnosc, choroba lokomocyjna).
//
// Rozmiar: `size` = srednica awatara w px; orbita wystaje ~6 px poza jego krawedz, a gwiazdka
// ma ~1/5 srednicy - przy awatarze 76 px stojacym 16 px od krawedzi ekranu lewa gwiazdka
// (srodek na orbicie, polowa szerokosci na zewnatrz) miesci sie w marginesie i nie jest ucinana.
const SPIN_S = 14;

export default function AvatarStarFrame({ size, className = "" }: { size: number; className?: string }) {
  const ring = size + 12;               // srednica orbity (srodki gwiazdek)
  const star = Math.max(12, Math.round(size * 0.19));
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${className}`}
      style={{ width: ring, height: ring }}
    >
      <span
        className="absolute inset-0 motion-reduce:[animation:none]"
        style={{ animation: `spontaway-orbit ${SPIN_S}s linear infinite` }}
      >
        {[0, 90, 180, 270].map((deg) => (
          <span
            key={deg}
            className="absolute left-1/2 top-1/2"
            style={{ width: star, height: star, transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(${-ring / 2}px)` }}
          >
            {/* Animacja nadpisuje statyczny transform, wiec kompensacja kata pozycji (-deg)
                siedzi o poziom nizej - inaczej kazda gwiazdka stalaby przekrecona o swoj kat. */}
            <span
              className="block h-full w-full motion-reduce:[animation:none]"
              style={{ animation: `spontaway-orbit-counter ${SPIN_S}s linear infinite` }}
            >
              <span className="block h-full w-full" style={{ transform: `rotate(${-deg}deg)` }}>
                <BrandIcon src={STAR_ICON} className="h-full w-full text-primary drop-shadow-[0_1px_2px_rgba(0,0,0,0.15)]" />
              </span>
            </span>
          </span>
        ))}
      </span>
      <style>{`
        @keyframes spontaway-orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spontaway-orbit-counter { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
      `}</style>
    </span>
  );
}
