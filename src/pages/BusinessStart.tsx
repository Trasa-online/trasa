import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";

const DRAFT_KEY = "draft_profile_id";

export default function BusinessStart() {
  const { t } = useTranslation("bizonboard");
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        // Resume existing draft if still valid
        const existingId = localStorage.getItem(DRAFT_KEY);
        if (existingId) {
          const { data } = await (supabase as any)
            .from("business_profiles")
            .select("id")
            .eq("id", existingId)
            .maybeSingle();
          if (data?.id) {
            navigate(`/biznes/${existingId}`, { replace: true });
            return;
          }
          localStorage.removeItem(DRAFT_KEY);
        }

        // Sign in anonymously so we get a real user.id to own the profile
        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
        if (anonError || !anonData.user) throw anonError ?? new Error(t("error.no_user"));

        const userId = anonData.user.id;

        // If this anon user already has a draft, go there
        const { data: existing } = await (supabase as any)
          .from("business_profiles")
          .select("id")
          .eq("owner_user_id", userId)
          .eq("is_draft", true)
          .maybeSingle();
        if (existing?.id) {
          localStorage.setItem(DRAFT_KEY, existing.id);
          navigate(`/biznes/${existing.id}`, { replace: true });
          return;
        }

        // Create a fresh draft profile
        const { data: profile, error: insertError } = await (supabase as any)
          .from("business_profiles")
          .insert({
            owner_user_id: userId,
            business_name: "",
            is_draft: true,
            is_active: false,
            plan: "zero",
          })
          .select("id")
          .single();

        if (insertError || !profile) throw insertError ?? new Error(t("error.create_failed"));

        localStorage.setItem(DRAFT_KEY, profile.id);
        navigate(`/biznes/${profile.id}`, { replace: true });
      } catch (err: any) {
        console.error("[BusinessStart]", err);
        setError(err?.message || err?.error_description || String(err) || t("error.unknown"));
      }
    })();
  }, [t]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#FEFEFE] flex flex-col items-center justify-center gap-5 px-6">
        <div className="h-14 w-14 rounded-full" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
        <p className="text-center text-muted-foreground text-sm max-w-[32ch]">
          {t("error.something_wrong")}
        </p>
        <p className="text-center text-red-500 text-xs font-mono max-w-xs break-words">{error}</p>
        <button
          onClick={() => { setError(null); window.location.reload(); }}
          className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold text-sm"
        >
          {t("error.refresh")}
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEFEFE] flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
    </div>
  );
}
