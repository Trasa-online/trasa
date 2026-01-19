import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

interface RouteSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectNewRoute: () => void;
  onSelectExistingRoute: (routeId: string) => void;
}

const RouteSelectionDialog = ({
  open,
  onOpenChange,
  onSelectNewRoute,
  onSelectExistingRoute,
}: RouteSelectionDialogProps) => {
  const { user } = useAuth();

  const { data: draftRoutes, isLoading } = useQuery({
    queryKey: ["draft-routes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("routes")
        .select("id, title, updated_at, created_at")
        .eq("user_id", user.id)
        .eq("status", "draft")
        .order("updated_at", { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!user && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm mx-auto">
        <DialogHeader>
          <DialogTitle>Dodaj pinezkę</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <Button
            variant="default"
            className="w-full justify-start"
            onClick={onSelectNewRoute}
          >
            <Plus className="h-4 w-4 mr-3" />
            Utwórz nową trasę
          </Button>

          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : draftRoutes && draftRoutes.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground font-medium">
                Lub dodaj do wersji roboczej:
              </p>
              {draftRoutes.map((route) => (
                <Button
                  key={route.id}
                  variant="outline"
                  className="w-full justify-start text-left h-auto py-3"
                  onClick={() => onSelectExistingRoute(route.id)}
                >
                  <FileText className="h-4 w-4 mr-3 shrink-0" />
                  <div className="flex flex-col items-start overflow-hidden">
                    <span className="truncate w-full font-medium">
                      {route.title || "Bez tytułu"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(route.updated_at || route.created_at), {
                        addSuffix: true,
                        locale: pl,
                      })}
                    </span>
                  </div>
                </Button>
              ))}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RouteSelectionDialog;
