import { useRef } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { QRCodeCanvas } from "qrcode.react";
import { Copy, Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// KOD QR LOKALU W PANELU (prosba Nat 2026-09-26). Kod drukowany na wizytowce lokalu prowadzi
// na `spontaway.com/q/<token>`: podrozny dostaje strone miejsca, a z apka - wizytowke.
// Tutaj lokal widzi SWOJ kod (lub kody), ile razy go zeskanowano i moze go pobrac jako PNG.
// Dane idzie przez SECDEF `my_business_qr_codes` (wlasciciel albo admin) - tabela kodow nie ma
// zadnych polityk.

const QR_BASE = "https://spontaway.com/q/";

type QrRow = { token: string; label: string | null; scans: number; last_scanned_at: string | null; claimed_at: string | null };

export function useBusinessQrCodes(businessId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["business-qr-codes", businessId],
    enabled: enabled && !!businessId,
    staleTime: 60_000,
    queryFn: async (): Promise<QrRow[]> => {
      const { data, error } = await (supabase as any).rpc("my_business_qr_codes", { p_business_id: businessId });
      if (error) { console.warn("[BusinessQrModal] my_business_qr_codes:", error.message); return []; }
      return (data ?? []) as QrRow[];
    },
  });
}

function QrCard({ row, businessName }: { row: QrRow; businessName: string }) {
  const { t } = useTranslation("bizdash");
  const wrap = useRef<HTMLDivElement>(null);
  const url = QR_BASE + row.token;

  // PNG w wysokiej rozdzielczosci do druku: renderujemy ukryty canvas 1200 px.
  const download = () => {
    const canvas = wrap.current?.querySelector<HTMLCanvasElement>("canvas[data-print]");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `spontaway-qr-${(businessName || row.token).toLowerCase().replace(/[^a-z0-9]+/gi, "-")}.png`;
    a.click();
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast.success(t("qr.copied")); }
    catch { toast.error(t("qr.copy_failed")); }
  };

  return (
    <div ref={wrap} className="rounded-3xl bg-[#FDF184] p-5 text-[#5B2C06]">
      <div className="mx-auto w-fit rounded-2xl bg-white p-4 shadow-sm">
        <QRCodeCanvas value={url} size={200} fgColor="#5B2C06" bgColor="#FFFFFF" level="M" marginSize={0} />
      </div>
      {/* Wersja do druku - niewidoczna, tylko zrodlo PNG. */}
      <div className="hidden">
        <QRCodeCanvas data-print value={url} size={1200} fgColor="#5B2C06" bgColor="#FFFFFF" level="M" marginSize={4} />
      </div>
      <p className="mt-4 text-center text-[13px] font-semibold break-all">{url.replace("https://", "")}</p>
      <p className="mt-1 text-center text-[12px] opacity-75">{t("qr.scans", { count: row.scans ?? 0 })}</p>
      <div className="mt-4 flex gap-2">
        <button onClick={download} className="flex-1 h-11 rounded-full bg-primary text-white text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
          <Download className="h-4 w-4" />{t("qr.download")}
        </button>
        <button onClick={() => void copy()} className="h-11 px-4 rounded-full bg-white text-[#5B2C06] text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
          <Copy className="h-4 w-4" />{t("qr.copy")}
        </button>
      </div>
    </div>
  );
}

export default function BusinessQrModal({ open, onClose, businessId, businessName }: {
  open: boolean;
  onClose: () => void;
  businessId: string | null | undefined;
  businessName: string;
}) {
  const { t } = useTranslation("bizdash");
  const { data: codes = [], isLoading } = useBusinessQrCodes(businessId, open);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-[calc(100%-16px)] mx-2 mb-2 sm:mb-0 max-w-md rounded-[32px] bg-white p-5 pb-[max(20px,env(safe-area-inset-bottom))] max-h-[90dvh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-900">{t("qr.title")}</h2>
            <p className="mt-0.5 text-sm text-slate-500">{t("qr.desc")}</p>
          </div>
          <button onClick={onClose} aria-label={t("qr.close")} className="h-9 w-9 shrink-0 rounded-full bg-slate-100 flex items-center justify-center active:scale-95">
            <X className="h-4 w-4 text-slate-600" />
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {isLoading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : codes.length === 0 ? (
            <div className="rounded-3xl bg-slate-50 px-5 py-8 text-center">
              <p className="text-[15px] font-bold text-slate-900">{t("qr.empty_title")}</p>
              <p className="mt-1 text-sm text-slate-500">{t("qr.empty_desc")}</p>
            </div>
          ) : (
            codes.map((c) => <QrCard key={c.token} row={c} businessName={businessName} />)
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
