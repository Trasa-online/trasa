import HomeHeaderActions from "@/components/home/HomeHeaderActions";
import ActiveTripsDashboard from "@/components/home/ActiveTripsDashboard";
import { useAuth } from "@/hooks/useAuth";

// Ekran "Twoje trasy" = dashboard "Aktywne" (ActiveTripsDashboard): aktywne trasy solo + grupowe,
// puste stany gdy brak. Swiper przegladania miejsc jest pod guzikiem "+" (FAB w BottomNav -> /plan).
// Onboarding nowego usera odpala sie na landingu (Eksploruj), nie tutaj.
const HomeSwipe = () => {
  const { user, isAnonymous } = useAuth();
  const isGuest = !user || isAnonymous;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="relative shrink-0 bg-background px-4 pt-3 pb-2.5 flex items-start justify-between gap-2 after:content-[''] after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-border/40">
        <div className="min-w-0">
          <h1 className="text-xl font-display font-extrabold tracking-tight">Twoje trasy</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Aktywne podróże, trasy grupowe i&nbsp;planowanie nowych.</p>
        </div>
        {/* Prawa: ikony w kolkach. */}
        <HomeHeaderActions />
      </div>

      <ActiveTripsDashboard userId={isGuest ? null : (user?.id ?? null)} />
    </div>
  );
};

export default HomeSwipe;
