import { useRef, useState, type ReactNode } from "react";
import { Trash2 } from "lucide-react";

// Wiersz z gestem przesunięcia w LEWO -> usunięcie (jak w natywnych listach iOS). Blokada
// kierunku: pierwszy znaczacy ruch decyduje czy to swipe poziomy (delete) czy scroll pionowy
// (wtedy nie przechwytujemy). Za progiem THRESHOLD wywoluje onDelete, ponizej wraca do 0.
export default function SwipeToDeleteRow({
  children,
  onDelete,
  disabled = false,
}: {
  children: ReactNode;
  onDelete: () => void;
  disabled?: boolean;
}) {
  const [dx, setDx] = useState(0);
  const [animating, setAnimating] = useState(true);
  const start = useRef<{ x: number; y: number } | null>(null);
  const mode = useRef<"none" | "h" | "v">("none");
  const THRESHOLD = -88;
  const MAX = -128;

  const onDown = (e: React.PointerEvent) => {
    if (disabled) return;
    start.current = { x: e.clientX, y: e.clientY };
    mode.current = "none";
    setAnimating(false);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return;
    const ddx = e.clientX - start.current.x;
    const ddy = e.clientY - start.current.y;
    if (mode.current === "none") {
      if (Math.abs(ddx) > 8 || Math.abs(ddy) > 8) mode.current = Math.abs(ddx) > Math.abs(ddy) ? "h" : "v";
    }
    if (mode.current === "h") setDx(Math.max(MAX, Math.min(0, ddx)));
  };
  const finish = () => {
    if (!start.current) return;
    const wasH = mode.current === "h";
    const past = dx <= THRESHOLD;
    start.current = null;
    mode.current = "none";
    setAnimating(true);
    if (wasH && past) { setDx(0); onDelete(); }
    else setDx(0);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Tlo usuwania (odslania sie przy przeciaganiu) */}
      <div className="absolute inset-y-0 right-0 flex items-center justify-end pr-6 bg-destructive rounded-2xl" style={{ width: Math.max(0, -dx) + 16 }}>
        <Trash2 className="h-5 w-5 text-white shrink-0" />
      </div>
      <div
        className="relative"
        style={{ transform: `translateX(${dx}px)`, transition: animating ? "transform 0.2s ease" : "none", touchAction: "pan-y" }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={finish}
        onPointerCancel={finish}
      >
        {children}
      </div>
    </div>
  );
}
