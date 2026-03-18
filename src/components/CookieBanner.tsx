import { useState, useEffect } from "react";
import { getConsent, grantConsent, denyConsent, syncConsentFromProfile } from "@/lib/consent";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const CookieBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check localStorage first (fast path for returning users)
    if (getConsent() !== null) return;

    // No local consent — check DB in case user is logged in
    syncConsentFromProfile().then((shouldShow) => {
      if (shouldShow) setVisible(true);
    });
  }, []);

  // Also show banner when a user logs in without prior consent
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" && getConsent() === null) {
        syncConsentFromProfile().then((shouldShow) => {
          if (shouldShow) setVisible(true);
        });
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-card border-t border-border/60 shadow-lg">
      <div className="max-w-lg mx-auto space-y-3">
        <p className="text-sm text-foreground leading-relaxed">
          Używamy plików cookies do analizy ruchu (Google Analytics) oraz nagrań sesji (Microsoft Clarity), żeby lepiej rozumieć jak korzystasz z aplikacji.{" "}
          <Link to="/terms" className="underline text-muted-foreground hover:text-foreground">
            Polityka prywatności
          </Link>
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => { grantConsent(); setVisible(false); }}
            className="flex-1 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold"
          >
            Akceptuję
          </button>
          <button
            onClick={() => { denyConsent(); setVisible(false); }}
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
