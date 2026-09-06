import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SavedRoutes, SavedCollections } from "@/components/home/DiscoveryFeed";

// Segment "Listy | Trasy" w zakładce Zapisane (profil): zapisane od innych - trasy + listy razem.
// JEDEN wspólny pusty stan (zamiast osobnych dla tras i list). Wyszukiwarka (w SavedCollections)
// pokazuje się tylko gdy są załadowane zapisane listy.
export function SavedListsRoutes({ city }: { city?: string }) {
  const { t } = useTranslation("homefeed");
  const { user } = useAuth();

  const { data: routeCount = 0 } = useQuery({
    queryKey: ["saved-routes-count", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("saved_routes").select("*", { count: "exact", head: true }).eq("user_id", user!.id);
      return count ?? 0;
    },
  });

  // Zapisane listy (od innych) trzymane jako ID w localStorage. Liczymy TYLKO te, ktore REALNIE
  // istnieja w DB - inaczej stare/usuniete ID (colCount>0 z localStorage) blokowaly pusty stan
  // i widok byl calkiem pusty (bug: brak empty state na "Listy | Trasy").
  const savedColIds = (() => {
    try { return JSON.parse(localStorage.getItem("trasa_saved_collections") || "[]") as string[]; }
    catch { return []; }
  })();
  const { data: colCount = 0 } = useQuery({
    queryKey: ["saved-collections-existing-count", [...savedColIds].sort().join(",")],
    enabled: savedColIds.length > 0,
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("discovery_collections").select("*", { count: "exact", head: true }).in("id", savedColIds);
      return count ?? 0;
    },
  });

  if (routeCount === 0 && colCount === 0) {
    return (
      <div className="pt-20 pb-12 text-center px-8">
        <span aria-hidden className="mx-auto mb-4 h-20 w-20" style={{ display: "block", backgroundColor: "#ef9d78", WebkitMaskImage: "url(/Ikona_Zapisane.svg)", maskImage: "url(/Ikona_Zapisane.svg)", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />
        <p className="text-base font-bold">Brak zapisanych list i tras</p>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-[280px] mx-auto">
          {t("empty.saved_any")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SavedRoutes city={city} hideEmptyState />
      <SavedCollections hideEmptyState />
    </div>
  );
}
