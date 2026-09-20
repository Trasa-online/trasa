import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { BrandCheck } from "@/components/BrandIcon";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usernameKey } from "@/lib/usernameRules";

// USUWANIE KONTA W DWoCH KROKACH (kierunek B + sciezka wspolna z eksploracji, 2026-09-17;
// makiety D1-D5 w Figmie). Do tego dnia byl to JEDEN rozwijany akapit z czerwonym guzikiem
// pod spodem - najslabiej zaprojektowana rzecz w aplikacji, a wymagana przez App Store.
//
// Krok 1: KONSEKWENCJE. Osobny ekran, bo tekstu jest za duzo na arkusz. Mowi wprost, co
//         znika NA ZAWSZE i - rownie wazne - co zostaje u innych ludzi.
// Krok 2: PRZEPISANIE NAZWY UZYTKOWNIKA (wzor: Comet). Czerwony guzik jest NIEAKTYWNY,
//         dopoki nazwa sie nie zgadza. To jedyna bariera, ktorej nie da sie pokonac odruchem.
// Stan koncowy: wylogowanie, ekran powitalny i toast - zeby bylo jawne, ze sie stalo.
//
// ⛔ Kasowanie idzie tym samym RPC, co dotad (`delete_current_user_account`). Ten plik
// zmienia DROGE do niego, nie samo kasowanie.

const CONSEQUENCES = ["trips", "collections", "notes", "stars", "follows", "messages"] as const;
const REMAINS = ["shared_collections", "group_trips"] as const;

export default function DeleteAccountFlow() {
  const { t } = useTranslation("settings");
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  const { data: username } = useQueryUsername(user?.id);
  const target = (username ?? "").trim();
  const matches = !!target && usernameKey(typed.replace(/^@/, "")) === usernameKey(target);

  const runDelete = async () => {
    if (!matches || deleting) return;
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_current_user_account" as any);
      if (error) throw error;
      await signOut();
      navigate("/");
      toast.success(t("delete.done"));
    } catch {
      toast.error(t("delete_error"));
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-background pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
      <div className="flex items-center gap-2 px-2 pt-2 pb-1">
        <button
          onClick={() => (step === 2 ? setStep(1) : navigate("/settings"))}
          aria-label={t("back")}
          className="h-9 w-9 flex items-center justify-center rounded-full text-muted-foreground active:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">{t("delete_account")}</h1>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-3">
        {step === 1 ? (
          <>
            <p className="text-[15px] leading-relaxed text-muted-foreground">{t("delete.intro")}</p>

            <p className="mt-7 text-[11px] font-bold uppercase tracking-wide text-destructive">{t("delete.gone_title")}</p>
            <ul className="mt-3 space-y-2.5">
              {CONSEQUENCES.map((k) => (
                <li key={k} className="flex gap-3 text-sm leading-relaxed text-foreground">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" aria-hidden />
                  {t(`delete.gone.${k}`)}
                </li>
              ))}
            </ul>

            <p className="mt-7 text-[11px] font-bold uppercase tracking-wide text-[#5B2C06]">{t("delete.stays_title")}</p>
            <ul className="mt-3 space-y-2.5">
              {REMAINS.map((k) => (
                <li key={k} className="flex gap-3 text-sm leading-relaxed text-foreground">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#5B2C06]" aria-hidden />
                  {t(`delete.stays.${k}`)}
                </li>
              ))}
            </ul>

            <button
              onClick={() => setStep(2)}
              className="mt-9 w-full rounded-[26px] bg-destructive py-4 text-[15px] font-bold text-destructive-foreground active:scale-[0.99] transition-transform"
            >
              {t("delete_account")}
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="mt-3 w-full py-3 text-[15px] font-semibold text-muted-foreground"
            >
              {t("cancel")}
            </button>
          </>
        ) : (
          <>
            <p className="text-[15px] leading-relaxed text-muted-foreground">{t("delete.type_intro")}</p>

            <div className="mt-6 rounded-2xl bg-muted/60 px-4 py-3">
              <span className="text-[15px] font-bold text-foreground">@{target}</span>
            </div>

            <p className="mt-6 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">{t("delete.type_label")}</p>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={`@${target}`}
              className={`mt-2 w-full rounded-2xl border bg-background px-4 py-3.5 text-[15px] outline-none ${matches ? "border-primary" : "border-border/60"}`}
            />
            <p className={`mt-2 flex items-center gap-1.5 text-xs ${matches ? "text-emerald-600" : "text-muted-foreground"}`}>
              {matches && <BrandCheck className="h-3.5 w-3.5" />}
              {matches ? t("delete.type_ok") : t("delete.type_hint")}
            </p>

            <button
              onClick={runDelete}
              disabled={!matches || deleting}
              className="mt-9 w-full rounded-[26px] bg-destructive py-4 text-[15px] font-bold text-destructive-foreground transition-opacity active:scale-[0.99] disabled:opacity-35"
            >
              {deleting ? t("deleting") : t("delete.confirm_cta")}
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="mt-3 w-full py-3 text-[15px] font-semibold text-muted-foreground"
            >
              {t("cancel")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// Nazwa uzytkownika do przepisania. Wlasny profil czytamy przez SECURITY DEFINER RPC -
// `profiles` ma kolumnowe granty, wiec `select("*")` by nie przeszlo (patrz CLAUDE.md).
import { useQuery } from "@tanstack/react-query";
function useQueryUsername(userId?: string | null) {
  return useQuery({
    queryKey: ["my-username", userId],
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<string> => {
      const { data: rows } = await (supabase as any).rpc("get_my_profile");
      const row = Array.isArray(rows) ? rows[0] : rows;
      return (row?.username as string) ?? "";
    },
  });
}
