import { useState } from "react";
import { X, Check, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fdTrack } from "./analytics";
import { nbsp } from "./text";
import type { MockRoute } from "./mockRoutes";

export type DoorSource = "use_route" | "create_route";

type Props = {
  source: DoorSource;
  route?: MockRoute | null;
  onClose: () => void;
};

const COPY: Record<DoorSource, { title: string; sub: string }> = {
  use_route: {
    title: "Świetny wybór!",
    sub: "Trasy w apce ruszają niedługo. Zostaw maila, a damy Ci znać jako jednej z pierwszych - i od razu odblokujesz tę trasę.",
  },
  create_route: {
    title: "Twórz własne trasy",
    sub: "Tworzenie własnych tras jest już w drodze. Zostaw maila, a odezwiemy się gdy tylko będzie gotowe.",
  },
};

const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export default function EmailModal({ source, route, onClose }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const copy = COPY[source];

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
      // Duplikat / kolizja tez traktujemy jak sukces (mail juz zlapany).
      if (error && !`${error.message}`.toLowerCase().includes("duplicate")) {
        // Nie blokujemy sygnalu na bledzie DB - event i tak leci.
        console.warn("[fakedoor] lead insert:", error.message);
      }
      fdTrack("fd_submit_email", {
        source,
        ...(route ? { route: route.id, city: route.city } : {}),
      });
      setStatus("done");
    } catch (e) {
      // Sygnal (event) juz poszedl przy kliknieciu drzwi; pokazujemy sukces.
      fdTrack("fd_submit_email", { source, ...(route ? { route: route.id } : {}) });
      setStatus("done");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4"
      style={{ background: "rgba(14,14,14,0.45)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white shadow-xl p-6 sm:p-7"
        style={{ fontFamily: "Inter, system-ui, sans-serif" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end -mt-1 -mr-1">
          <button
            onClick={onClose}
            aria-label="Zamknij"
            className="p-1.5 rounded-full text-[#979797] hover:bg-black/5 transition"
          >
            <X size={20} />
          </button>
        </div>

        {status === "done" ? (
          <div className="text-center px-2 pb-2">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "linear-gradient(135deg,#F4A259,#F9662B)" }}
            >
              <Check size={28} className="text-white" />
            </div>
            <h2 className="text-xl font-extrabold text-[#0E0E0E]">Jesteś na liście</h2>
            <p className="mt-2 text-[#979797] leading-relaxed">
              {nbsp("Dzięki! Odezwiemy się na tego maila, gdy tylko wystartujemy.")}
            </p>
            <button
              onClick={onClose}
              className="mt-6 w-full rounded-2xl py-3 font-bold text-[#0E0E0E] bg-secondary hover:opacity-90 transition"
            >
              Wróć do tras
            </button>
          </div>
        ) : (
          <div className="px-1">
            {route && source === "use_route" && (
              <p className="text-xs font-semibold uppercase tracking-wide text-[#F9662B] mb-1">
                {route.title}
              </p>
            )}
            <h2 className="text-xl font-extrabold text-[#0E0E0E]">{nbsp(copy.title)}</h2>
            <p className="mt-2 text-[#979797] leading-relaxed">{nbsp(copy.sub)}</p>

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
              className="mt-5 w-full rounded-2xl border px-4 py-3 text-base text-[#0E0E0E] outline-none transition placeholder:text-[#CFCFCF] focus:border-[#F9662B]"
              style={{ borderColor: status === "error" ? "#ef4444" : "#e5e7eb" }}
            />
            {status === "error" && (
              <p className="mt-1.5 text-xs text-red-500">{nbsp("Wpisz poprawny adres e-mail.")}</p>
            )}

            <button
              onClick={submit}
              disabled={status === "sending"}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-bold text-white transition disabled:opacity-70"
              style={{ background: "linear-gradient(90deg,#F4A259,#F9662B)" }}
            >
              {status === "sending" ? <Loader2 size={18} className="animate-spin" /> : null}
              {status === "sending" ? "Zapisuję..." : "Powiadomcie mnie"}
            </button>
            <p className="mt-3 text-center text-[11px] text-[#CFCFCF]">
              {nbsp("Bez spamu. Jeden mail, gdy ruszamy.")}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
