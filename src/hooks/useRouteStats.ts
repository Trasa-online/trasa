import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface RouteStats {
  uses: number;        // ile razy zapisano moje trasy (kazde zapisanie)
  people: number;      // ile ROZNYCH osob wykorzystalo moje trasy
  views: number;       // laczne wyswietlenia
  completions: number; // ile razy ukonczono moje trasy
}

// Statystyki wykorzystania WLASNYCH tras (RPC my_route_stats - SECURITY DEFINER, tylko wolajacy).
export function useMyRouteStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-route-stats", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<RouteStats> => {
      const { data } = await (supabase as any).rpc("my_route_stats");
      const row = Array.isArray(data) ? data[0] : data;
      return {
        uses: Number(row?.uses ?? 0),
        people: Number(row?.people ?? 0),
        views: Number(row?.views ?? 0),
        completions: Number(row?.completions ?? 0),
      };
    },
  });
}
