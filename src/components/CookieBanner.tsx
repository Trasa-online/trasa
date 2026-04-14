import { useState, useEffect } from "react";
import { getConsent, grantConsent, denyConsent, syncConsentFromProfile, getSessionConsent, grantSessionConsent, denySessionConsent } from "@/lib/consent";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const CookieBanner = () => {
  const { user, loading } = useAuth();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (loading) return;

    if (user) {
      // Logged-in: show only if never consented (localStorage + DB)
      if (getConsent() !== null) return;
      syncConsentFromProfile().then((shouldShow) => {
        if (shouldShow) setVisible(true);
      });
    } else {
      // Not logged in: show every new browser session (sessionStorage)
      if (getSessionConsent() === null) setVisible(true);
    }
  }, [user, loading]);

  if (!visible) return null;

  const handleGrant = () => {
    if (user) grantConsent(); else grantSessionConsent();
    setVisible(false);
  };

  const handleDeny = () => {
    if (user) denyConsent(); else denySessionConsent();
    setVisible(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[60] p-4 bg-card border-t border-border/60 shadow-lg">
      <div className="max-w-lg mx-auto space-y-3">
        <p className="text-sm text-foreground leading-relaxed">
          Używamy plików cookies do analizy ruchu (Google Analytics) oraz nagrań sesji (Microsoft Clarity), żeby lepiej rozumieć jak korzystasz z aplikacji.{" "}
          <Link to="/terms" className="underline text-muted-foreground hover:text-foreground">
            Polityka prywatności
          </Link>
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleGrant}
            className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold"
          >
            Akceptuję
          </button>
          <button
            onClick={handleDeny}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground bg-card"
          >
            Tylko niezbędne
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
