import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { isNative } from "@/lib/platform";
import { haptics } from "@/hooks/useHaptics";
import { BrandKeyboardHide } from "@/components/BrandIcon";

// Plywajacy guzik "schowaj klawiature" NAD klawiatura (prosba Nat 2026-09-18). WKWebView nie ma
// paska z "Gotowe" nad klawiatura dla pol w stronie (Capacitor go wylacza), wiec user, ktory
// wpisal nazwe albo notke, nie mial jak zamknac klawiatury poza tapnieciem gdzies obok - a to
// czesto trafialo w cos klikalnego pod spodem.
//
// Pozycja: `fixed bottom` = gorna krawedz klawiatury, bo Keyboard.resize = 'native' ZMNIEJSZA
// caly WebView o wysokosc klawiatury (capacitor.config.ts). Nie dokladaj tu `keyboardHeight`
// z eventu - przy natywnym resize podwoiloby przesuniecie i guzik wisialby w polowie ekranu.
//
// Kolory z marki (zolty + braz + biala obwodka), ta sama skora co skrot do wyjazdu w Eksploracji:
// biala obwodka to nie ozdoba - guzik lezy nad dowolna trescia, takze nad zoltymi arkuszami.
export default function KeyboardDismissButton() {
  const { t } = useTranslation("common");
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!isNative) return;
    let cancelled = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];
    (async () => {
      try {
        const { Keyboard } = await import("@capacitor/keyboard");
        if (cancelled) return;
        // `Will` zamiast `Did`: guzik ma wjechac razem z klawiatura, nie po niej. Chowamy tez
        // na `Will`, zeby nie wisial sam nad pusta przestrzenia przez czas animacji.
        handles.push(await Keyboard.addListener("keyboardWillShow", () => setShown(true)));
        handles.push(await Keyboard.addListener("keyboardWillHide", () => setShown(false)));
      } catch (e) {
        console.warn("[KeyboardDismiss] keyboard plugin unavailable:", e instanceof Error ? e.message : e);
      }
    })();
    return () => { cancelled = true; handles.forEach((h) => { void h.remove(); }); };
  }, []);

  if (!isNative || !shown) return null;

  const hide = async () => {
    haptics.light();
    // Blur pola wystarcza, zeby iOS schowal klawiature; Keyboard.hide() to domkniecie na
    // wypadek pola, ktore fokus trzyma poza DOM-em (np. natywny picker w WebView).
    (document.activeElement as HTMLElement | null)?.blur?.();
    try { const { Keyboard } = await import("@capacitor/keyboard"); await Keyboard.hide(); } catch { /* juz schowana */ }
  };

  return (
    <button
      type="button"
      // `onPointerDown` + preventDefault: tapniecie NIE zabiera fokusu polu ZANIM je zblurujemy,
      // wiec nie ma migniecia, w ktorym klawiatura zaczyna sie chowac i wraca.
      onPointerDown={(e) => { e.preventDefault(); void hide(); }}
      aria-label={t("keyboard.hide")}
      data-no-drag
      className="fixed right-3 bottom-3 z-[80] flex h-11 w-11 items-center justify-center rounded-full bg-[#FDF184] text-[#5B2C06] border-2 border-white shadow-[0_2px_10px_rgba(0,0,0,0.18)] active:scale-95 transition-transform animate-in fade-in zoom-in-75 duration-150"
    >
      {/* Brandowa ikona "schowaj klawiature" od Nat (2026-09-18) - maska + currentColor, wiec bierze braz z guzika. */}
      <BrandKeyboardHide className="h-6 w-6" />
    </button>
  );
}
