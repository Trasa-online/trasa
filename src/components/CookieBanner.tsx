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
    <div className="fixed bottom-4 left-0 right-0 z-[60] flex justify-center px-4">
      <div className="bg-[#1a1a1a] rounded-2xl shadow-2xl px-4 py-3 flex items-center gap-3 max-w-md w-full">
        <span className="text-xl shrink-0">🍪</span>
        <p className="text-xs text-white/70 leading-snug flex-1">
          Używamy cookies do analizy ruchu.{" "}
          <Link to="/terms" className="text-white/50 underline hover:text-white/80 transition-colors">
            Polityka prywatności
          </Link>
        </p>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={handleDeny}
            className="px-3 py-1.5 rounded-xl border border-white/20 text-white/60 text-xs font-medium hover:border-white/40 hover:text-white/80 transition-colors"
          >
            Niezbędne
          </button>
          <button
            onClick={handleGrant}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white text-xs font-bold shadow-md transition-opacity hover:opacity-90"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
