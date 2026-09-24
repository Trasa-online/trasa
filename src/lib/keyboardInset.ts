import { isNative } from "@/lib/platform";

// KLAWIATURA ZASLANIA ARKUSZ, A PO CHWILI „PRZESKAKUJE" (zgloszenie testerow 2026-09-24).
//
// Co sie dzialo: `Keyboard.resize = 'native'` (capacitor.config.ts) zmniejsza CALY WebView
// o wysokosc klawiatury, wiec arkusz przypiety do dolu (`bottom-2`) sam znajduje sie nad nia -
// ale DOPIERO gdy natywny resize dojedzie. Przez te ~200-300 ms klawiatura stoi NA arkuszu,
// a potem arkusz skacze w gore. Widac to wszedzie, gdzie cos sie wpisuje.
//
// Pomysl: na `keyboardWillShow` (zdarzenie leci PRZED animacja i niesie wysokosc) podnosimy
// arkusz SAMI, zmienna `--kb`. Gdy natywny resize faktycznie dojedzie - a poznajemy to po tym,
// ze okno sie skurczylo - zerujemy `--kb`. Obie pozycje sa IDENTYCZNE (`h` nad stara krawedzia
// = przy nowej krawedzi), wiec podmiana jest niewidoczna: znika i zaslanianie, i skok.
//
// ⛔ Podnosimy przez `bottom`, NIE przez `transform`: animacja wejscia arkusza (tailwindcss-animate)
// nadpisuje `transform` i panel wjezdzalby z boku zamiast z dolu (patrz CLAUDE.md, „Gesty natywne").
//
// ⚠️ Gdyby ktores zdarzenie nie przyszlo (inna wersja iOS, klawiatura sprzetowa), `--kb` zeruje
// bezpiecznik czasowy - arkusz nigdy nie zostaje wiszacy w powietrzu.

const VAR = "--kb";
const SAFETY_MS = 700;

let started = false;

function setKb(px: number) {
  document.documentElement.style.setProperty(VAR, `${Math.max(0, Math.round(px))}px`);
}

export function initKeyboardInset(): void {
  if (started || !isNative || typeof window === "undefined") return;
  started = true;
  setKb(0);

  let pending = 0;          // wysokosc, o ktora sami podniesliismy layout
  let heightBefore = 0;     // wysokosc okna sprzed klawiatury
  let safety: number | null = null;

  const clear = () => {
    pending = 0;
    if (safety) { window.clearTimeout(safety); safety = null; }
    setKb(0);
  };

  // Natywny resize dojechal (okno skurczylo sie mniej wiecej o wysokosc klawiatury)
  // -> nasze podniesienie przestaje byc potrzebne i MUSI zniknac, inaczej podwoi odstep.
  const onViewport = () => {
    if (!pending) return;
    if (window.innerHeight <= heightBefore - pending * 0.5) clear();
  };

  void (async () => {
    try {
      const { Keyboard } = await import("@capacitor/keyboard");
      await Keyboard.addListener("keyboardWillShow", (info) => {
        const h = Number((info as { keyboardHeight?: number })?.keyboardHeight ?? 0);
        heightBefore = window.innerHeight;
        if (!h) return;
        // Okno juz jest skurczone (resize wyprzedzil zdarzenie) - nie ma czego podnosic.
        pending = h;
        setKb(h);
        if (safety) window.clearTimeout(safety);
        safety = window.setTimeout(clear, SAFETY_MS);
      });
      await Keyboard.addListener("keyboardWillHide", clear);
      await Keyboard.addListener("keyboardDidHide", clear);
    } catch (e) {
      console.warn("[keyboardInset] plugin niedostepny:", e instanceof Error ? e.message : e);
    }
  })();

  window.visualViewport?.addEventListener("resize", onViewport);
  window.addEventListener("resize", onViewport);
}
