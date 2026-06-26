import { useState, useEffect } from "react";
import { Bell, Heart, Shield, ChevronDown, MapPin, X } from "lucide-react";
import { format, parseISO, isValid } from "date-fns";
import { pl } from "date-fns/locale";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useActiveSoloTrips } from "@/hooks/useActiveSoloTrips";
import { resolveStored } from "@/components/PlacePhoto";
import NotificationsDrawer from "@/components/layout/NotificationsDrawer";
import HomeTour, { useHomeTour } from "@/components/home/HomeTour";
import ProfileSetup, { useProfileSetup } from "@/components/home/ProfileSetup";
import ActiveTripsDashboard from "@/components/home/ActiveTripsDashboard";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { isHardcodedAdmin } from "@/lib/admins";

const fmtRange = (min?: string | null, max?: string | null) => {
  if (!min || !isValid(parseISO(min))) return null;
  if (!max || min === max || !isValid(parseISO(max))) return format(parseISO(min), "d MMM yyyy", { locale: pl });
  return `${format(parseISO(min), "d MMM", { locale: pl })} – ${format(parseISO(max), "d MMM yyyy", { locale: pl })}`;
};

// Karta trasy w dropdownie selektora: do 3 mini-zdjec miejsc (+N), miasto, zakres dat.
function TripSelectorCard({ trip, active, onSelect }: { trip: any; active: boolean; onSelect: () => void }) {
  const pins = Array.isArray(trip.pins) ? trip.pins : [];
  const photos = pins.map((p: any) => resolveStored(p.photo_url)).filter(Boolean).slice(0, 3) as string[];
  const extra = Math.max(0, pins.length - 3);
  return (
    <button
      onClick={onSelect}
      className={`shrink-0 w-44 rounded-2xl border p-2.5 text-left transition-colors active:scale-[0.98] ${active ? "border-orange-400 bg-orange-50/60" : "border-border/50 bg-card"}`}
    >
      <div className="flex gap-1 mb-2">
        {photos.length > 0 ? photos.map((url, i) => (
          <img key={i} src={url} alt="" className="h-12 flex-1 min-w-0 rounded-lg object-cover bg-muted" loading="lazy" />
        )) : (
          <div className="h-12 w-full rounded-lg bg-muted flex items-center justify-center"><MapPin className="h-4 w-4 text-muted-foreground" /></div>
        )}
        {extra > 0 && (
          <div className="h-12 flex-1 min-w-0 rounded-lg bg-foreground/85 text-background text-[11px] font-bold flex items-center justify-center">+{extra}</div>
        )}
      </div>
      <p className="text-sm font-display font-extrabold leading-tight truncate">{trip.city || trip.title || "Trasa"}</p>
      {fmtRange(trip._dateMin, trip._dateMax) && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{fmtRange(trip._dateMin, trip._dateMax)}</p>}
    </button>
  );
}

// Ekran glowny = dashboard "Aktywne" (ActiveTripsDashboard): aktywne trasy solo + grupowe,
// puste stany gdy brak. Swiper przegladania miejsc jest pod guzikiem "+" (FAB w BottomNav -> /plan).
const HomeSwipe = () => {
  const { user, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const isAdmin = isHardcodedAdmin(user?.email);
  const { open: openAuthDrawer } = useAuthDrawer();
  const isGuest = !user || isAnonymous;
  const { showTour, dismissTour } = useHomeTour(isGuest);
  const { showSetup, finishSetup } = useProfileSetup();
  // Zalogowany nowy user: najpierw intro (czym jest apka), potem setup profilu.
  const [introSeen, setIntroSeen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const queryClient = useQueryClient();

  // Aktywne trasy solo (wspolny hook z Dashboardem). Selector pojawia sie TYLKO gdy >1 trasa.
  const { data: soloTrips = [] } = useActiveSoloTrips(isGuest ? null : user?.id);
  const [selectedSoloId, setSelectedSoloId] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const selectedTrip = soloTrips.find((t: any) => t.id === selectedSoloId) ?? soloTrips[0] ?? null;
  const hasManyTrips = soloTrips.length > 1;

  // Powiadomienia tylko dla zalogowanych non-anon (anon nie ma rekordow w notifications).
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications-unread", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false)
        .neq("type", "group_match");
      return count ?? 0;
    },
    enabled: !!user && !isAnonymous,
    refetchInterval: 30_000,
  });

  // Realtime: instant badge update on new notification.
  useEffect(() => {
    if (!user || isAnonymous) return;
    const channel = supabase
      .channel(`homeswipe-notif-badge-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications-unread", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, isAnonymous]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {showTour && <HomeTour onDone={dismissTour} />}
      {showSetup && !introSeen && <HomeTour lastLabel="Dalej" onDone={() => setIntroSeen(true)} />}
      {showSetup && introSeen && <ProfileSetup onDone={finishSetup} />}

      {/* Top bar */}
      <div className="relative shrink-0 bg-background px-4 pt-3 pb-2.5 flex items-center justify-between gap-2 after:content-[''] after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-border/40">
        {/* Lewa: selector aktywnych tras (gdy >1) albo tytul "Twoje trasy". */}
        {hasManyTrips && !isGuest ? (
          <button
            onClick={() => setSelectorOpen(true)}
            className="flex items-center gap-1.5 min-w-0 rounded-2xl bg-muted px-3 py-2 active:scale-[0.97] transition-transform"
            aria-label="Wybierz aktywną trasę"
          >
            <span className="text-base font-display font-extrabold truncate max-w-[170px]">{selectedTrip?.city || selectedTrip?.title || "Aktywne"}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </button>
        ) : (
          <div className="min-w-0">
            <h1 className="text-xl font-display font-extrabold tracking-tight">Twoje trasy</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Aktywne podróże, trasy grupowe i&nbsp;planowanie nowych.</p>
          </div>
        )}
        {/* Prawa: ikony w kolkach. */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isGuest ? (
            <button
              onClick={() => openAuthDrawer({ mode: "login" })}
              className="text-xs font-semibold text-orange-600 px-3 py-2 rounded-full hover:bg-orange-50 active:scale-[0.97] transition-all"
            >
              Zaloguj się
            </button>
          ) : (
            <button
              onClick={() => setNotifOpen(true)}
              className="relative h-9 w-9 flex items-center justify-center rounded-full bg-muted text-foreground active:scale-90 transition-transform"
              aria-label="Powiadomienia"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 rounded-full bg-primary text-white text-[8px] font-bold flex items-center justify-center px-1 leading-none ring-2 ring-background">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          )}
          {!isGuest && (
            <button
              onClick={() => navigate("/polubione")}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-muted text-foreground active:scale-90 transition-transform"
              aria-label="Polubione miejsca"
              title="Polubione"
            >
              <Heart className="h-[18px] w-[18px]" />
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-blue-50 text-blue-600 active:scale-90 transition-transform"
              aria-label="Panel admina"
              title="Panel admina"
            >
              <Shield className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </div>

      {/* Notifications drawer */}
      {notifOpen && user && !isAnonymous && (
        <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} userId={user.id} />
      )}

      {/* Selector aktywnych tras - karty z mini-zdjeciami, do przesuwania w bok. */}
      <Sheet open={selectorOpen} onOpenChange={setSelectorOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl p-0 [&>button]:hidden">
          <div className="px-5 pt-5 pb-[max(20px,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-lg font-display font-extrabold">Aktywne trasy</p>
              <button onClick={() => setSelectorOpen(false)} aria-label="Zamknij" className="h-8 w-8 rounded-full bg-muted flex items-center justify-center active:scale-90 transition-transform">
                <X className="h-4 w-4 text-foreground" />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-5 px-5 pb-1">
              {soloTrips.map((trip: any) => (
                <TripSelectorCard
                  key={trip.id}
                  trip={trip}
                  active={trip.id === selectedTrip?.id}
                  onSelect={() => { setSelectedSoloId(trip.id); setSelectorOpen(false); }}
                />
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <ActiveTripsDashboard userId={isGuest ? null : (user?.id ?? null)} selectedSoloId={selectedTrip?.id ?? null} />
    </div>
  );
};

export default HomeSwipe;
