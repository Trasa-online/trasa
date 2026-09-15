import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { App as CapApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { supabase } from "@/integrations/supabase/client";
import { isNative, platform } from "@/lib/platform";
import { TrasaLogo } from "@/components/TrasaLogo";

// "Hamulec awaryjny" po premierze (2026-09-11). Po publikacji w App Store stare wersje zyja
// na telefonach tygodniami, a poprawka przechodzi review 1-2 dni. Ten komponent czyta zdalna
// konfiguracje (tabela app_config, klucz ios_update / android_update) i porownuje
// `min_build` z numerem builda zainstalowanej aplikacji (CFBundleVersion):
//   - mode 'block': ekran aktualizacji BEZ wyjscia - dla builda, ktory np. psuje dane;
//   - mode 'nag':   ten sam ekran z "Później" - raz na uruchomienie.
// Sprawdzamy przy starcie i po kazdym powrocie do aplikacji (appStateChange), zeby podniesiony
// prog dzialal bez restartu.
//
// FAIL-OPEN, celowo: brak sieci, blad zapytania, brak wiersza, niepoprawny JSON, nieznany
// numer builda - wszystko to znaczy "nie blokuj". Zla konfiguracja nie moze wylaczyc aplikacji.
//
// Podniesienie progu = jedno UPDATE w bazie (przyklad w migracji 20260911c). Zero deployu.

type UpdateCfg = {
  min_build?: number;
  mode?: "block" | "nag";
  store_url?: string | null;
  message?: { pl?: string; en?: string } | null;
};

const CONFIG_KEY = platform === "android" ? "android_update" : "ios_update";
// "Później" w trybie nag: pamietamy per uruchomienie aplikacji (sessionStorage znika po ubiciu).
const SNOOZE_KEY = "spontaway_update_snoozed_build";

export default function UpdateGate() {
  const { t, i18n } = useTranslation("common");
  const [state, setState] = useState<{ cfg: UpdateCfg; build: number } | null>(null);
  const [snoozed, setSnoozed] = useState(() => {
    try { return sessionStorage.getItem(SNOOZE_KEY); } catch { return null; }
  });

  useEffect(() => {
    if (!isNative) return;
    let cancelled = false;
    const check = async () => {
      try {
        const info = await CapApp.getInfo();
        const build = Number.parseInt(String(info.build ?? ""), 10);
        if (!Number.isFinite(build)) return;                       // nie wiemy, jaka wersja -> nie blokuj
        const { data, error } = await supabase.from("app_config" as any).select("value").eq("key", CONFIG_KEY).maybeSingle();
        if (error || !data || cancelled) return;
        const cfg = ((data as any).value ?? {}) as UpdateCfg;
        const min = Number(cfg.min_build ?? 0);
        if (!Number.isFinite(min)) return;
        setState(build < min ? { cfg, build } : null);
      } catch (e) {
        console.warn("[UpdateGate] check skipped:", e instanceof Error ? e.message : e);
      }
    };
    void check();
    const sub = CapApp.addListener("appStateChange", ({ isActive }) => { if (isActive) void check(); });
    return () => { cancelled = true; void sub.then((h) => h.remove()); };
  }, []);

  if (!state) return null;
  const { cfg, build } = state;
  const mode = cfg.mode === "nag" ? "nag" : "block";
  if (mode === "nag" && snoozed === String(build)) return null;

  const lang = (i18n.language || "pl").startsWith("en") ? "en" : "pl";
  const message = cfg.message?.[lang] || cfg.message?.pl || t("update.body");
  // Link do App Store przez Browser (SFSafariViewController) - iOS sam proponuje tam przejscie
  // do aplikacji App Store. (@capacitor/app 8 nie ma juz openUrl; AppLauncher nie jest wpiety.)
  const openStore = () => {
    const url = cfg.store_url;
    if (!url) return;
    void Browser.open({ url }).catch(() => { window.open(url, "_blank"); });
  };
  const snooze = () => {
    try { sessionStorage.setItem(SNOOZE_KEY, String(build)); } catch { /* prywatne okno */ }
    setSnoozed(String(build));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="update-gate-title"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 bg-background px-8 text-center"
      style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
    >
      <TrasaLogo size={64} />
      <h1 id="update-gate-title" className="text-2xl font-black text-foreground leading-tight">{t("update.title")}</h1>
      <p className="max-w-[30ch] text-[15px] leading-relaxed text-muted-foreground">{message}</p>
      <div className="mt-2 flex w-full max-w-[300px] flex-col gap-2">
        {cfg.store_url && (
          <button onClick={openStore} className="w-full rounded-2xl bg-primary py-3.5 text-base font-bold text-white active:scale-[0.98] transition-transform">
            {t("update.cta")}
          </button>
        )}
        {mode === "nag" && (
          <button onClick={snooze} className="w-full rounded-2xl py-3 text-sm font-semibold text-muted-foreground active:text-foreground transition-colors">
            {t("update.later")}
          </button>
        )}
      </div>
    </div>
  );
}
