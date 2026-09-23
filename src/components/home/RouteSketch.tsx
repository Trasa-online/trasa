// SZKIC TRASY zamiast mini-mapy z Google (2026-09-22).
//
// ⛔ Powod jest kosztowy, nie estetyczny: mini-mapka na kafelku to Maps Static ($2/1000),
// a Google w naglowku swojej odpowiedzi daje `max-age=86400` - czyli KAZDA trasa odswieza sie
// raz na dobe i dluzej cache'owac nie wolno (to instrukcja Google, nie nasza decyzja).
// Przy 20 tys. tras to ~600 tys. wywolan miesiecznie. Tutaj: zero.
//
// ⚠️ Przy 108 px podkladu mapy i tak praktycznie nie widac - czytelny jest wylacznie UKLAD
// pinezek. Dlatego rysujemy to, co niesie informacje (ksztalt trasy), w kolorach marki.
//
// Rzut: rownoprostokatny z korekta cos(szerokosc) - bez niej trasa w Gdansku bylaby sciagnieta
// w poziomie o ~40%. Skala jest WSPOLNA dla obu osi, wiec ksztalt sie nie deformuje.

interface SketchPin { latitude?: number | null; longitude?: number | null }

const BOX = 100;
const PAD = 16;          // margines, zeby kropki przy krawedzi nie byly przyciete
const MIN_SPAN = 0.0009; // ~100 m: punkty blisko siebie nie moga rozjechac sie na caly kafelek

export function RouteSketch({
  pins, className, showRoute = true, grid = false,
}: { pins: SketchPin[]; className?: string; showRoute?: boolean; grid?: boolean }) {
  const pts = (pins ?? [])
    .filter((p) => p.latitude != null && p.longitude != null)
    .slice(0, 20)
    .map((p) => ({ lat: Number(p.latitude), lng: Number(p.longitude) }));

  if (!pts.length) return null;

  const meanLat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const kx = Math.cos((meanLat * Math.PI) / 180) || 1;
  const xs = pts.map((p) => p.lng * kx);
  const ys = pts.map((p) => -p.lat);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, MIN_SPAN);
  const spanY = Math.max(maxY - minY, MIN_SPAN);
  // Jedna skala na obie osie = brak deformacji; reszta miejsca idzie na wysrodkowanie.
  const scale = (BOX - 2 * PAD) / Math.max(spanX, spanY);
  const offX = (BOX - spanX * scale) / 2;
  const offY = (BOX - spanY * scale) / 2;
  const xy = pts.map((p, i) => ({
    x: offX + (xs[i] - minX) * scale,
    y: offY + (ys[i] - minY) * scale,
  }));

  const d = xy.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const r = pts.length > 8 ? 4.2 : 5.2;

  return (
    <svg viewBox={`0 0 ${BOX} ${BOX}`} className={className} aria-hidden focusable="false">
      <rect width={BOX} height={BOX} fill="#FCEDE3" />
      {grid && (
        <g stroke="#FFFFFF" strokeWidth="1.6" opacity="0.55">
          {[20, 40, 60, 80].map((v) => <line key={`h${v}`} x1="0" y1={v} x2={BOX} y2={v} />)}
          {[20, 40, 60, 80].map((v) => <line key={`v${v}`} x1={v} y1="0" x2={v} y2={BOX} />)}
        </g>
      )}
      {showRoute && xy.length > 1 && (
        <path d={d} fill="none" stroke="#EE5307" strokeWidth="2.6" strokeLinecap="round"
          strokeLinejoin="round" opacity="0.5" />
      )}
      {xy.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={r} fill="#FFFFFF" />
          <circle cx={p.x} cy={p.y} r={r - 1.6} fill="#EE5307" />
        </g>
      ))}
    </svg>
  );
}
