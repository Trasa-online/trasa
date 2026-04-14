import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.tsx";
import "./index.css";
import "./i18n";
import { getConsent } from "@/lib/consent";

// Fire Clarity immediately for users who already granted consent
if (getConsent() === "granted" && typeof (window as any)._clarityInit === "function") {
  (window as any)._clarityInit();
}

// ─── Sentry error tracking ────────────────────────────────────────────────────
if (import.meta.env.PROD) {
  Sentry.init({
    dsn: "https://043934f5cfe39c7f2ea9fd2da11be1ad@o4511209012264960.ingest.de.sentry.io/4511209017704528",
    environment: import.meta.env.MODE, // "development" | "production"
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: false,
        blockAllMedia: false,
      }),
    ],
    // 10% próbkowanie transakcji w produkcji
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
    // 10% sesji nagrywanych jako replay przy błędzie
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.1,
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Analytics />
  </StrictMode>
);
