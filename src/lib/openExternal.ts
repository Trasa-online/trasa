import { Browser } from "@capacitor/browser";
import { isNative } from "@/lib/platform";

// Otworz zewnetrzny link tak, by dalo sie WROCIC do apki: natywnie in-app Safari (Browser.open =
// SFSafariViewController z przyciskiem "Gotowe"/"Done"), na web nowa karta. Zwykly window.open("_blank")
// na iOS otwieral zewnetrznego Safari BEZ mozliwosci powrotu do aplikacji (feedback Nat 2026-08-25).
export async function openExternal(url: string): Promise<void> {
  if (isNative) {
    try { await Browser.open({ url }); return; } catch { /* fallback ponizej */ }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
