import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fdTrack } from "./analytics";
import { nbsp } from "./text";
import { BRAND } from "./theme";
import { routeCover, type MockRoute } from "./mockRoutes";

export type DoorSource = "use_route" | "create_route";

type Props = {
  source: DoorSource;
  route?: MockRoute | null;
  onClose: () => void;
};

type Copy = {
  eyebrow: string;
  title: string;
  sub: string;
  cta: string;
  doneTitle: string;
  doneSub: string;
};

const COPY: Record<DoorSource, Copy> = {
  use_route: {
    eyebrow: "Wybrana trasa",
    title: "Dobry wybór",
    sub: "Apka rusza lada chwila. Zostaw maila, a odłożymy tę trasę dla Ciebie i damy znać na starcie.",
    cta: "Chcę tę trasę",
    doneTitle: "Trasa zaklepana",
    doneSub: "Damy znać na tego maila, gdy tylko odpalimy. Trasa czeka na Ciebie.",
  },
  create_route: {
    eyebrow: "Własna trasa",
    title: "Ułóż własną trasę",
    sub: "Tworzenie tras dopinamy właśnie teraz. Zostaw maila, a damy znać, gdy tylko ruszy.",
    cta: "Chcę tworzyć",
    doneTitle: "Jesteś na liście",
    doneSub: "Damy znać na tego maila, gdy ruszy tworzenie tras. Będziesz wśród pierwszych.",
  },
};

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function EmailModal({ source, route, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [shown, setShown] = useState(false);
  const copy = COPY[source];

  // Wjazd sheeta od dolu (native feel).
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const close = () => {
    setShown(false);
    window.setTimeout(onClose, 220);
  };

  const submit = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!isValidEmail(trimmed)) {
      setStatus("error");
      return;
    }
    setStatus("sending");
    try {
      const { error } = await supabase.from("fakedoor_leads").insert({
        email: trimmed,
        source,
        route_id: route?.id ?? null,
        route_title: route?.title ?? null,
        city: route?.city ?? null,
      });
      if (error && !`${error.message}`.toLowerCase().includes("duplicate")) {
        console.warn("[fakedoor] lead insert:", error.message);
      }
      fdTrack("fd_submit_email", { source, ...(route ? { route: route.id, city: route.city } : {}) });
      setStatus("done");
    } catch {
      fdTrack("fd_submit_email", { source, ...(route ? { route: route.id } : {}) });
      setStatus("done");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center" onClick={close}>
      {/* Overlay */}
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{ background: "rgba(14,14,14,0.5)", opacity: shown ? 1 : 0 }}
      />

      {/* Sheet */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[480px] rounded-t-[28px] bg-white transition-transform ease-out"
        style={{
          fontFamily: "Inter, system-ui, sans-serif",
          transform: shown ? "translateY(0)" : "translateY(100%)",
          transitionDuration: "240ms",
          paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
          boxShadow: "0 -12px 40px rgba(0,0,0,0.18)",
        }}
      >
        {/* Uchwyt */}
        <div className="flex justify-center pt-3">
          <div className="h-1.5 w-10 rounded-full bg-black/15" />
        </div>

        <div className="px-5 pt-3">
          {status === "done" ? (
            <div className="pb-2">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full" style={{ background: BRAND }}>
                <Check size={28} className="text-white" />
              </div>
              <h2 className="text-2xl font-black text-[#0E0E0E]">{nbsp(copy.doneTitle)}</h2>
              <p className="mt-2 leading-relaxed text-[#6b6b6b]">{nbsp(copy.doneSub)}</p>
              <button
                onClick={close}
                className="mt-6 w-full rounded-2xl bg-[#f0f0f1] py-3.5 font-bold text-[#0E0E0E] transition active:scale-[0.99]"
              >
                Gotowe
              </button>
            </div>
          ) : (
            <>
              {route && source === "use_route" && (
                <div className="mb-4 flex items-center gap-3 rounded-2xl bg-[#f4f4f5] p-2.5">
                  <img src={routeCover(route.id)} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#979797]">{copy.eyebrow}</p>
                    <p className="truncate font-bold text-[#0E0E0E]">{route.title}</p>
                  </div>
                </div>
              )}

              <h2 className="text-2xl font-black text-[#0E0E0E]">{nbsp(copy.title)}</h2>
              <p className="mt-2 leading-relaxed text-[#6b6b6b]">{nbsp(copy.sub)}</p>

              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (status === "error") setStatus("idle");
                }}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                placeholder="twój@email.pl"
                className={`mt-5 w-full rounded-2xl px-4 py-3.5 text-base text-[#0E0E0E] outline-none transition placeholder:text-[#a8a8ad] ${
                  status === "error" ? "bg-red-50 ring-2 ring-red-300" : "bg-[#f2f2f4] focus:ring-2 focus:ring-[#D25014]/40"
                }`}
              />
              {status === "error" && (
                <p className="mt-1.5 text-sm text-red-500">{nbsp("Sprawdź jeszcze ten adres e-mail.")}</p>
              )}

              <button
                onClick={submit}
                disabled={status === "sending"}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white transition active:scale-[0.99] disabled:opacity-70"
                style={{ background: BRAND }}
              >
                {status === "sending" ? <Loader2 size={18} className="animate-spin" /> : null}
                {status === "sending" ? "Zapisuję..." : nbsp(copy.cta)}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
