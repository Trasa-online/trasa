import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, Settings2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { BrandIcon, BrandBell } from "@/components/BrandIcon";
import { isNative } from "@/lib/platform";
import { haptics } from "@/hooks/useHaptics";
import { cn } from "@/lib/utils";
import {
  askPermission, closePrimer, getSystemStatus, usePermissionPrimer,
  type PermKind, type PrimerRequest, type SystemStatus,
} from "@/lib/permissionPrompts";

// Arkusz "miekkiego pytania" o zgode systemowa (lib/permissionPrompts). Jeden komponent,
// zamontowany raz w App.tsx; tresc zalezy od rodzaju zgody i kontekstu (klucze
// common:permissions.<kind>.<ctx>), wariant "settings" = zgoda juz odrzucona, jedyna droga to
// Ustawienia telefonu. Styl jak potwierdzenia (alert-dialog): plywajacy panel, tresc
// wysrodkowana, akcja NAD "Nie teraz", oba guziki pelnej szerokosci.

function KindGlyph({ kind, className = "h-8 w-8" }: { kind: PermKind; className?: string }) {
  return kind === "push"
    ? <BrandBell className={className} strokeWidth={2.2} />
    : <BrandIcon src="/Ikona_Miejsca.svg" className={className} />;
}

export default function PermissionPrimerSheet() {
  const req = usePermissionPrimer();
  // Ostatnie zadanie zostaje na czas animacji zamykania (Radix odtwarza slide-out z tresci).
  const [last, setLast] = useState<PrimerRequest | null>(null);
  useEffect(() => { if (req) setLast(req); }, [req]);
  const view = req ?? last;
  if (!isNative || !view) return null;
  return <PrimerBody open={!!req} view={view} />;
}

function PrimerBody({ open, view }: { open: boolean; view: PrimerRequest }) {
  const { t } = useTranslation("common");
  const base = `permissions.${view.kind}`;
  const settings = view.variant === "settings";
  const title = settings ? t(`${base}.denied.title`) : t(`${base}.${view.ctx}.title`);
  const desc = settings ? t(`${base}.denied.desc`) : t(`${base}.${view.ctx}.desc`);
  const cta = settings ? t("permissions.open_settings") : t(`${base}.enable`);

  const accept = () => { haptics.light(); closePrimer("accept"); };
  const later = () => closePrimer("later");

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) later(); }}>
      <SheetContent
        side="bottom"
        className="bg-background px-6 pt-8 pb-[max(24px,env(safe-area-inset-bottom))] [&>button:last-child]:hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <div className="flex flex-col items-center text-center gap-3">
          <div className="h-[72px] w-[72px] rounded-full bg-[#FCEDE3] text-[#5B2C06] flex items-center justify-center">
            {settings ? <Settings2 className="h-8 w-8" strokeWidth={2.2} /> : <KindGlyph kind={view.kind} />}
          </div>
          <h2 className="text-xl font-black leading-tight text-foreground px-1">{title}</h2>
          <p className="text-[15px] leading-relaxed text-muted-foreground px-1">{desc}</p>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <button type="button" onClick={accept} className="h-12 w-full rounded-full bg-primary text-white text-base font-bold active:scale-[0.98] transition-transform">
            {cta}
          </button>
          <button type="button" onClick={later} className="h-12 w-full rounded-full bg-secondary text-secondary-foreground text-base font-bold active:scale-[0.98] transition-transform">
            {t("permissions.later")}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Aktualny stan zgody systemowej (odswiezany przy kazdym otwarciu / powrocie do apki), do
// kart i wierszy, ktore pokazuja "wlaczone / wylaczone".
export function useSystemPermission(kind: PermKind, active = true): [SystemStatus | null, () => void] {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const refresh = () => { void getSystemStatus(kind).then((s) => { if (!cancelled) setStatus(s); }); };
    refresh();
    // Powrot z Ustawien telefonu: WebView dostaje visibilitychange - odczytaj zgode ponownie.
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; document.removeEventListener("visibilitychange", onVis); };
  }, [kind, active, nonce]);
  return [status, () => setNonce((n) => n + 1)];
}

// Karta w szufladzie powiadomien: jawne wejscie w zgode na push (dzwonek = user sam pokazuje,
// ze powiadomienia go interesuja). Znika, gdy zgoda jest; przy odmowie prowadzi do Ustawien.
export function PushNudgeCard({ className, open = true }: { className?: string; open?: boolean }) {
  const { t } = useTranslation("common");
  const [status, refresh] = useSystemPermission("push", open);
  const [busy, setBusy] = useState(false);
  if (!isNative || !status || status === "granted" || status === "unsupported") return null;
  const onTap = async () => {
    if (busy) return;
    setBusy(true);
    try { await askPermission("push", "bell", { explicit: true }); } finally { setBusy(false); refresh(); }
  };
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={busy}
      className={cn("flex items-center gap-3 rounded-2xl bg-[#FDF184] px-4 py-3 text-left active:scale-[0.99] transition-transform", className)}
    >
      <span className="h-10 w-10 shrink-0 rounded-full bg-white/70 text-[#5B2C06] flex items-center justify-center">
        <BrandBell className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-[#5B2C06]">{t("permissions.push.bell.title")}</span>
        <span className="block text-xs text-[#5B2C06]/80 leading-snug">
          {status === "denied" ? t("permissions.push.denied.short") : t("permissions.push.bell.short")}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[#5B2C06]/70" />
    </button>
  );
}
