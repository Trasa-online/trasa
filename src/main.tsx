import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { isWeb, isNative } from "@/lib/platform";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { initClarityOnBoot } from "@/lib/consent";

// Clarity dla userow, ktorzy juz wczesniej wyrazili zgode. Przez initClarityOnBoot, bo
// bezposrednie wywolanie _clarityInit() omijalo DWIE reguly: wykluczenie kont wewnetrznych
// oraz brak nagrywania w aplikacji natywnej (bateria).
void initClarityOnBoot();

// ─── Sentry error tracking (lazy-loaded to keep main bundle slim) ─────────────
if (import.meta.env.PROD) {
  import("@sentry/react").then((Sentry) => {
    // BATERIA: Session Replay (rrweb) przy replaysOnErrorSampleRate > 0 nagrywa CIAGLE do bufora
    // przez cala sesje, zeby miec co wyslac przy bledzie - w natywce to godziny obserwowania DOM.
    // Na native zostawiamy same bledy (to po nie tu jestesmy) i mniej probek tracingu; replay i
    // pelny tracing tylko na webie, gdzie sesje sa krotkie i urzadzenie jest podlaczone do pradu.
    Sentry.init({
      dsn: "https://043934f5cfe39c7f2ea9fd2da11be1ad@o4511209012264960.ingest.de.sentry.io/4511209017704528",
      environment: import.meta.env.MODE,
      integrations: isNative
        ? []
        : [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
          ],
      tracesSampleRate: isNative ? 0 : 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: isNative ? 0 : 0.1,
    });
  });
}

// ─── PostHog analytics (lazy-loaded; provider attaches after init) ────────────
function PostHogBoot({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ Provider: any; client: any } | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      import("posthog-js"),
      import("@posthog/react"),
    ]).then(([phMod, phReact]) => {
      if (cancelled) return;
      const posthog = phMod.default;
      posthog.init(import.meta.env.VITE_PUBLIC_POSTHOG_PROJECT_TOKEN, {
        api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
        defaults: "2026-01-30",
        // autocapture WYLACZONE (2026-09-04): lapalo kazde klikniecie w DOM i robilo 70%
        // calego wolumenu zdarzen (11,7 tys. na 17 tys. w 30 dni), zjadajac limit planu i
        // topiac nazwane zdarzenia produktowe w szumie. Bylo tez jednym z podejrzanych
        // w audycie baterii. Mierzymy wylacznie zdarzenia nazwane - patrz lib/analytics.ts.
        autocapture: false,
        // capture_pageview: false - apka na HashRouter, automatyczny $pageview (History API)
        // nie lapie zmian route (tylko pierwszy load). Pageviews capturuje recznie RouteTracker
        // (App.tsx) przy kazdej zmianie lokalizacji - dziala tak samo na native i web.
        capture_pageview: false,
        capture_pageleave: true,
        // GDPR: czekamy na zgode usera (cookie banner). Jesli juz wczesniej
        // zaakceptowal, opt_in_capturing() ponizej wlaczy tracking.
        opt_out_capturing_by_default: true,
      });
      (window as any).posthog = posthog;
      const existingConsent = localStorage.getItem("trasa_cookie_consent_v2");
      if (existingConsent === "granted") posthog.opt_in_capturing();
      setState({ Provider: phReact.PostHogProvider, client: posthog });
    });
    return () => { cancelled = true; };
  }, []);

  if (!state) return <>{children}</>;
  const { Provider, client } = state;
  return <Provider client={client}>{children}</Provider>;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogBoot>
      <App />
      {isWeb && <Analytics />}
      {isWeb && <SpeedInsights />}
    </PostHogBoot>
  </StrictMode>
);
