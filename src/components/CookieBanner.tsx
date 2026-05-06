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
      <div className="relative bg-[#0E0E0E] rounded-2xl shadow-2xl px-5 pt-5 pb-5 flex flex-col gap-4 max-w-md w-full">
        <button
          onClick={handleDismiss}
          aria-label="Zamknij"
          className="absolute top-3 right-3 h-8 w-8 flex items-center justify-center text-white/60 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
        <p className="text-sm text-white/85 leading-relaxed pr-8">
          Ta witryna korzysta z plików cookie, znaczników pikselowych i pamięci lokalnej w celu poprawy wydajności, personalizacji i prowadzenia działań marketingowych. Używamy własnych plików cookie oraz niektórych plików cookie innych firm. Domyślnie włączone są tylko niezbędne pliki cookie.{" "}
          <Link to="/terms" className="text-white underline hover:text-white/80 transition-colors">
            Ustawienia plików cookie
          </Link>
        </p>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={handleGrant}
            className="w-full rounded-2xl bg-white text-[#0E0E0E] text-base font-semibold px-4 py-4 hover:bg-white/90 transition-colors"
          >
            Zezwalaj na korzystanie ze wszystkich plików cookie
          </button>
          <button
            onClick={handleDeny}
            className="w-full rounded-2xl bg-white text-[#0E0E0E] text-base font-semibold px-4 py-4 hover:bg-white/90 transition-colors"
          >
            Nie zezwalaj na korzystanie z plików cookie
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
