import { useState, useEffect } from "react";
import { getConsent, grantConsent, denyConsent, syncConsentFromProfile, getSessionConsent, grantSessionConsent, denySessionConsent } from "@/lib/consent";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { X } from "lucide-react";

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

  const handleDismiss = () => {
    if (user) denyConsent(); else denySessionConsent();
    setVisible(false);
  };

  return (
    <div
      className="fixed left-0 right-0 z-[60] flex justify-center px-4"
      style={{ bottom: "max(env(safe-area-inset-bottom, 0px), 0px)", paddingBottom: 16 }}
    >
      <div className="relative bg-[#0E0E0E] rounded-2xl shadow-2xl px-4 py-3 flex flex-col gap-3 max-w-md w-full">
        <button
          onClick={handleDismiss}
          aria-label="Zamknij"
          className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center text-white/60 hover:text-white transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
        <p className="text-xs text-white/85 leading-relaxed pr-7">
          Używamy plików cookie do analityki i personalizacji.{" "}
          <Link to="/terms" className="text-white underline hover:text-white/80 transition-colors">
            Więcej
          </Link>
        </p>
        <div className="flex gap-2">
          <button
            onClick={handleDeny}
            className="flex-1 rounded-xl bg-white/10 text-white text-sm font-semibold px-3 py-2.5 hover:bg-white/15 transition-colors"
          >
            Tylko niezbędne
          </button>
          <button
            onClick={handleGrant}
            className="flex-1 rounded-xl bg-white text-[#0E0E0E] text-sm font-semibold px-3 py-2.5 hover:bg-white/90 transition-colors"
          >
            Akceptuję
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
