import { useEffect, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { isNative } from "@/lib/platform";
import { Browser } from "@capacitor/browser";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { toast } from "sonner";
import { usePostHog } from "@posthog/react";
import { X } from "lucide-react";

// OAuth-only drawer (Apple / Google + continue as guest). Email/haslo + magic link
// register zostaly usuniete - obecnie kazdy uzytkownik laczy sie przez OAuth, a stary
// kod email/password (handleLogin, handleRegister, handleForgotPassword + cale form'y)
// nie byl wywolywany z UI od kilku tygodni. JSX renderuje tylko 2 OAuth buttons + gosc.

const AuthDrawer = () => {
  const { isOpen, hint, close } = useAuthDrawer();
  const { isAnonymous, user } = useAuth();
  const posthog = usePostHog();

  const [loading, setLoading] = useState(false);

  // Intent-based cleanup: gdy user otwiera login NIE w celu zapisu trasy
  // (np. z Dziennika, Profilu, HomeSwipe topbar), wyczyść 'trasa_guest_plan' i
  // 'trasa_demo_liked' - inaczej AppLayout/Auth.tsx post-login useEffect zlapie
  // stary plan z localStorage i nieoczekiwanie navigate'uje na /create.
  // Tylko hint='save_route' (klikniecie 'Zaplanuj trase' w PlaceSwiper) zachowuje
  // guest_plan - to jedyny intent ktory ma traktowac login jako 'kontynuuj tworzenie'.
  useEffect(() => {
    if (!isOpen) return;
    if (hint === "save_route") return;
    try {
      localStorage.removeItem("trasa_guest_plan");
      localStorage.removeItem("trasa_demo_liked");
    } catch { /* unavailable */ }
  }, [isOpen, hint]);

  // Reset transient state when drawer closes
  useEffect(() => {
    if (!isOpen) setLoading(false);
  }, [isOpen]);

  // OAuth zwraca usera dopiero po redirect/deep linku - nie z handleOAuth.
  // Domykamy drawer i resetujemy loading dopiero gdy user state faktycznie sie
  // zmienil na non-null.
  useEffect(() => {
    if (user && !isAnonymous && isOpen) {
      setLoading(false);
      close();
    }
  }, [user, isAnonymous, isOpen, close]);

  const handleOAuth = async (provider: "apple" | "google") => {
    setLoading(true);
    try {
      // Zachowaj sciezke sesji grupowej przed OAuth (web wraca na origin/ -> GlobalAuthCallback).
      // Bez tego po logowaniu na /sesja/* lapiemy /home = waitlista na web.
      const path = window.location.hash.slice(1);
      const returnTo = path.startsWith("/sesja") ? path : null;
      try {
        if (returnTo) sessionStorage.setItem("trasa_post_login_redirect", returnTo);
      } catch { /* sessionStorage unavailable */ }
      // Zawsze signInWithOAuth (jak Auth.tsx). Wczesniej dla anonimowych uzywalismy
      // linkIdentity zeby zachowac anon data (sesje grupowe, polubione miejsca),
      // ale to silently failuje gdy Google email juz ma konto w spontaway - user wraca
      // jako gosc bez widocznego bledu. Tradeoff: anon data nie przenosi sie przy
      // OAuth, ale flow dziala niezawodnie dla wszystkich przypadkow.
      // Cel powrotu doklejamy TEZ jako ?next= - przezywa round-trip OAuth gdy
      // sessionStorage gubi sie (in-app browser, np. Messenger).
      const redirectTo = isNative
        ? "travel.trasa.app://auth/callback"
        : `${window.location.origin}/${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ""}`;
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo, skipBrowserRedirect: isNative },
      });
      if (error) throw error;
      if (isNative && data?.url) {
        await Browser.open({ url: data.url, presentationStyle: "popover" });
      }
    } catch (err: any) {
      posthog.captureException(err);
      const msg = err?.message?.toLowerCase() || "";
      if (msg.includes("provider is not enabled") || msg.includes("unsupported")) {
        toast.error(`Logowanie przez ${provider === "apple" ? "Apple" : "Google"} nie jest jeszcze skonfigurowane.`);
      } else {
        toast.error(err.message || "Błąd logowania");
      }
      setLoading(false);
    }
  };

  const hintMessage = hint === "journal"
    ? "Załóż konto, żeby mieć dziennik podróży i zapisywać wspomnienia."
    : hint === "save_route"
      ? "Załóż konto, żeby zapisać swoją trasę."
      : hint === "join_session"
        ? "Załóż konto, żeby dołączyć do sesji grupowej."
        : hint === "settings"
          ? "Zaloguj się, żeby zmieniać ustawienia konta."
          : null;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open) close(); }}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl flex flex-col p-0 bg-background [&>button]:hidden"
        style={{ maxHeight: "92dvh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="h-9 w-9 rounded-full"
              style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }}
            />
            <div>
              <p className="text-base font-black tracking-tight leading-none">trasa</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">speed dating z miastem</p>
            </div>
          </div>
          <button
            onClick={close}
            className="h-9 w-9 -mr-1 flex items-center justify-center text-muted-foreground active:text-foreground"
            aria-label="Zamknij"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          <div className="space-y-1 mb-5">
            <p className="text-xl font-black leading-tight">
              Zaloguj się lub dołącz do&nbsp;Trasy
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Zapisuj trasy, prowadź dziennik, planuj grupowo.
            </p>
          </div>

          {hintMessage && (
            <div className="mb-4 px-4 py-3 rounded-2xl bg-orange-50 border border-orange-200">
              <p className="text-sm text-foreground leading-snug">{hintMessage}</p>
            </div>
          )}

          {/* OAuth buttons */}
          <div className="flex flex-col gap-2 mb-4">
            <button
              type="button"
              onClick={() => handleOAuth("apple")}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 bg-black text-white font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Kontynuuj z Apple
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 bg-white border border-slate-200 text-foreground font-semibold text-sm active:scale-[0.98] transition-transform disabled:opacity-60"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Kontynuuj z Google
            </button>
          </div>

        </div>
      </SheetContent>
    </Sheet>
  );
};

export default AuthDrawer;
