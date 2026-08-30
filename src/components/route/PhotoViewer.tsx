import { X } from "lucide-react";
import { useState } from "react";
import { useSwipeNav } from "@/hooks/useSwipeNav";
import PhotoPagination from "./PhotoPagination";

// Pelnoekranowy podglad zdjec (miejsca / galerii wyjazdu). Gest w bok = poprzednie/nastepne
// (kropki na dole zamiast strzalek - prosba Nat 2026-08-30), tap w tlo zamyka. Wspoldzielony przez widok wyjazdu i listy,
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
      <PhotoPagination count={urls.length} index={idx} />
    </div>
  );
}
