import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sparkles, Mic, BookOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";

const Home = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("home");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!loading && user && profile !== undefined && (profile as any)?.onboarding_completed === false) {
      navigate("/onboarding");
    }
  }, [loading, user, profile, navigate]);

  if (loading) return null;

  // ── Landing for unauthenticated ──
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 max-w-sm mx-auto w-full">
        <div className="text-center mb-10">
          <div className="h-16 w-16 rounded-full orb-gradient mx-auto mb-6" />
          <h1 className="text-3xl font-black tracking-tight mb-3">TRASA</h1>
          <p className="text-lg font-semibold mb-2">{t("landing.tagline")}</p>
          <p className="text-muted-foreground text-sm max-w-[280px] mx-auto leading-relaxed">
            {t("landing.description")}
          </p>
        </div>
        <div className="w-full space-y-2.5 mb-10">
          <div className="flex items-start gap-3 rounded-2xl bg-card border border-border/50 p-4">
            <Sparkles className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
            <div>
              <p className="text-sm font-semibold">{t("landing.feature1_title")}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t("landing.feature1_desc")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl bg-card border border-border/50 p-4">
            <Mic className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
            <div>
              <p className="text-sm font-semibold">{t("landing.feature2_title")}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t("landing.feature2_desc")}</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl bg-card border border-border/50 p-4">
            <BookOpen className="h-5 w-5 shrink-0 mt-0.5 text-primary" />
            <div>
              <p className="text-sm font-semibold">{t("landing.feature3_title")}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{t("landing.feature3_desc")}</p>
            </div>
          </div>
        </div>
        <div className="w-full space-y-2">
          <Button onClick={() => navigate("/auth?tab=register")} size="lg" className="w-full rounded-full text-base font-semibold">
            {t("landing.start_free")}
          </Button>
          <Button onClick={() => navigate("/auth")} variant="outline" size="lg" className="w-full rounded-full text-base font-medium bg-card">
            {t("landing.login")}
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-8">
          <Link to="/terms" className="underline">{t("landing.terms")}</Link>
        </p>
      </div>
    );
  }

  // ── Authenticated home: big card + CTA ──
  const firstName = (profile as any)?.first_name;

  return (
    <div className="flex-1 flex flex-col px-4 pt-3 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] gap-3">
      {/* Main card — fills remaining height */}
      <div className="flex-1 w-full bg-card border border-border/40 rounded-3xl flex flex-col items-center justify-center gap-6 px-8 py-10">
        <img src="/icon-192.png" alt="TRASA" className="w-20 h-20 rounded-2xl" style={{ boxShadow: "1px 1px 4px rgba(0,0,0,0.1)" }} />
        <div className="text-center">
          <h1 className="text-3xl font-black tracking-tight">TRASA</h1>
          {firstName && (
            <p className="text-sm text-muted-foreground mt-1">
              {t("greeting_with_name", { name: firstName })}
            </p>
          )}
        </div>
        <button
          onClick={() => navigate("/plan")}
          className="w-full py-4 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-[0.98] transition-all text-white font-bold text-base shadow-lg shadow-orange-600/20"
        >
          + {t("add_plan")}
        </button>
      </div>

      {/* Admin shortcut */}
      {user.email === "nat.maz98@gmail.com" && (
        <button
          onClick={() => navigate("/admin/routes")}
          className="self-center text-xs bg-orange-600/10 text-orange-600 font-semibold px-4 py-2 rounded-full"
        >
          🗺️ Trasy wzorcowe
        </button>
      )}
    </div>
  );
};

export default Home;
