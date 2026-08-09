import { useOfflineStatus } from "@/hooks/useOfflineStatus";

// Globalny wskaznik trybu offline - plywajaca pigulka nad BottomNavem, widoczna na wszystkich
// zakladkach (montowana w AppLayout). Ikona: public/Ikona_Offline.svg. Znika gdy wraca siec.
export default function OfflineBanner() {
  const offline = useOfflineStatus();
  if (!offline) return null;
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 rounded-full bg-[#fcede3] border border-orange-200 shadow-lg px-4 py-2 animate-in fade-in slide-in-from-bottom-2 duration-200"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 82px)" }}
      role="status"
      aria-live="polite"
    >
      <img src="/Ikona_Offline.svg" alt="" className="h-4 w-4 shrink-0" draggable={false} />
      <span className="text-xs font-bold text-orange-900">Jesteś offline</span>
    </div>
  );
}
