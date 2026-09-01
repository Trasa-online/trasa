import { useEffect } from "react";
import { isNative } from "@/lib/platform";

// Nasluch ZRZUTU EKRANU. Sygnal przychodzi z natywnego mostu (ios/App/App/ScreenshotPlugin.swift),
// bo iOS nie wystawia `userDidTakeScreenshotNotification` do WebView.
//
// Czego to NIE robi: nie przechwytuje zrzutu ani go nie podmienia - system nie daje takiej
// mozliwosci. Dostajemy wylacznie informacje "user wlasnie zrobil zrzut", wiec karta pojawia sie
// PO nim (jak na Pintereście) i user robi drugi zrzut, juz z gotowym kadrem.
//
// Na webie hook jest no-opem: przegladarka nie ma zadnego zdarzenia zrzutu ekranu.
export function useScreenshot(onScreenshot: () => void, enabled = true) {
  useEffect(() => {
    if (!isNative || !enabled) return;
    let remove: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      try {
        const { registerPlugin } = await import("@capacitor/core");
        const Screenshot = registerPlugin<any>("Screenshot");
        const handle = await Screenshot.addListener("screenshotTaken", () => onScreenshot());
        if (cancelled) { void handle?.remove?.(); return; }
        remove = () => { void handle?.remove?.(); };
      } catch (e) {
        // Brak wtyczki (starszy build natywki) - po prostu nic nie nasluchujemy.
        console.warn("[useScreenshot]", e instanceof Error ? e.message : e);
      }
    })();

    return () => { cancelled = true; remove?.(); };
  }, [onScreenshot, enabled]);
}
