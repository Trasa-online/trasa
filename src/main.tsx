import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { getConsent } from "@/lib/consent";

// Fire Clarity immediately for users who already granted consent
if (getConsent() === "granted" && typeof (window as any)._clarityInit === "function") {
  (window as any)._clarityInit();
}

// ─── Sentry error tracking (lazy-loaded to keep main bundle slim) ─────────────
if (import.meta.env.PROD) {
  import("@sentry/react").then((Sentry) => {
    Sentry.init({
      dsn: "https://043934f5cfe39c7f2ea9fd2da11be1ad@o4511209012264960.ingest.de.sentry.io/4511209017704528",
      environment: import.meta.env.MODE,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({ maskAllText: false, blockAllMedia: false }),
      ],
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.1,
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
        autocapture: true,
        capture_pageview: true,
        capture_pageleave: true,
      });
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
      <Analytics />
      <SpeedInsights />
    </PostHogBoot>
  </StrictMode>
);
