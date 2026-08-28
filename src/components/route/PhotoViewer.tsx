import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useSwipeNav } from "@/hooks/useSwipeNav";

// Pelnoekranowy podglad zdjec (miejsca / galerii wyjazdu). Gest w bok = poprzednie/nastepne,
// strzalki jako alternatywa, tap w tlo zamyka. Wspoldzielony przez widok wyjazdu i listy,
// zeby zdjecie dodane do miejsca dalo sie po prostu kliknac i obejrzec.
export default function PhotoViewer({ urls, startIndex, onClose }: {
  urls: string[];
  startIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(Math.max(0, Math.min(startIndex, urls.length - 1)));
  const step = (dir: 1 | -1) => setIdx((i) => (i + dir + urls.length) % urls.length);
  const swipe = useSwipeNav({ onLeft: () => step(1), onRight: () => step(-1), enabled: urls.length > 1 });
  if (!urls.length) return null;

  return (
    <div
      {...swipe}
      // pointerEvents: podglad bywa otwierany z wnetrza arkusza/drawera (modal ustawia
      // `pointer-events: none` na body) - bez tego caly ekran bylby martwy.
      style={{ pointerEvents: "auto" }}
      className="fixed inset-0 z-[130] bg-black flex items-center justify-center animate-in fade-in duration-200"
      onClick={onClose}
    >
      <img src={urls[idx]} alt="" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        aria-label="Zamknij"
        className="absolute right-3 z-10 h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
        style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <X className="h-5 w-5 text-white" />
      </button>
      {urls.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); step(-1); }} aria-label="Poprzednie"
            className="absolute left-2 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform">
            <ChevronLeft className="h-6 w-6 text-white" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); step(1); }} aria-label="Następne"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform">
            <ChevronRight className="h-6 w-6 text-white" />
          </button>
          <span className="absolute bottom-[max(24px,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 text-white/85 text-sm font-medium">
            {idx + 1} / {urls.length}
          </span>
        </>
      )}
    </div>
  );
}
