import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, ArrowRight } from "lucide-react";

export default function DiscoveryBanner() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    supabase
      .from("creator_places")
      .select("id")
      .eq("is_active", true)
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setVisible(true);
      });
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => navigate("/create")}
      className="w-full text-left rounded-2xl border border-border bg-card p-4 flex items-center gap-3 hover:bg-muted/30 active:bg-muted/50 transition-colors mb-6"
    >
      <div className="h-10 w-10 rounded-xl bg-foreground flex items-center justify-center shrink-0">
        <Sparkles className="h-5 w-5 text-background" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Polecane przez lokalnych twórców</p>
        <p className="text-xs text-muted-foreground mt-0.5">Odkryj sprawdzone miejsca i zaplanuj podróż</p>
      </div>
      <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}
