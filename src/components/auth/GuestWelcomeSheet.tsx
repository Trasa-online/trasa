import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { getConsent, CONSENT_RESOLVED_EVENT } from "@/lib/consent";

// Persistent across browser sessions - X = never again.
const DISMISS_KEY = "trasa_guest_welcome_dismissed_v1";

const GuestWelcomeSheet = () => {
  const { user, loading } = useAuth();
  const { open: openAuthDrawer } = useAuthDrawer();
  const [open, setOpen] = useState(false);

  // "Gosc" w UI = brak usera ALBO anon (Supabase Anonymous Auth - dostali
  // realne user_id, ale nie maja maila/profilu, traktujemy jako gosc).
  const isGuestUi = !user || user.is_anonymous;

  useEffect(() => {
    if (loading) return;
    if (!isGuestUi) return;
    let dismissed = false;
    try { dismissed = localStorage.getItem(DISMISS_KEY) === "1"; } catch { /* unavailable */ }
    if (dismissed) return;

    // Linear flow: NIE pokazuj guest sheet dopoki user nie rozprawi sie z cookie bannerem
    // (X / Akceptuję / Tylko niezbędne). Dwa sheety naraz powodowaly buggy taps.
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => { timeoutId = setTimeout(() => setOpen(true), 2000); };

    if (getConsent() !== null) {
      // Cookie consent juz podjety (returning visit) - schedule normalnie
      schedule();
      return () => { if (timeoutId) clearTimeout(timeoutId); };
    }

    // Cookie banner widoczny - czekaj az user kliknie cokolwiek
    const handler = () => {
      window.removeEventListener(CONSENT_RESOLVED_EVENT, handler);
      schedule();
    };
    window.addEventListener(CONSENT_RESOLVED_EVENT, handler);
    return () => {
      window.removeEventListener(CONSENT_RESOLVED_EVENT, handler);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [isGuestUi, loading]);

  const persistDismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* unavailable */ }
  };

  const handleClose = () => {
    persistDismiss();
    setOpen(false);
  };

  const handleSignUp = () => {
    persistDismiss();
    setOpen(false);
    openAuthDrawer({ mode: "register" });
  };

  // Don't show for non-anon logged-in users
  if (!isGuestUi) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl p-0 bg-background border-none"
        style={{ height: "auto" }}
      >
        <div className="px-6 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div
              className="h-12 w-12 rounded-full shrink-0"
              style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }}
            />
            <div className="flex-1">
              <p className="text-lg font-black tracking-tight leading-snug">
                Cześć! Przeglądasz jako&nbsp;gość
              </p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Wszystko działa bez konta. Załóż konto, jeśli chcesz zapisać trasę albo prowadzić dziennik podróży. Zajmuje minutę.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-2 mt-1">
            <button
              onClick={handleSignUp}
              className="w-full py-3 rounded-full bg-primary text-white font-bold text-sm shadow-md shadow-orange-500/20 active:scale-[0.97] transition-transform"
            >
              Załóż konto
            </button>
            <button
              onClick={handleClose}
              className="w-full py-3 rounded-full bg-white text-foreground font-bold text-sm border border-border/40 shadow-sm active:scale-[0.97] transition-transform"
            >
              Może później
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default GuestWelcomeSheet;
