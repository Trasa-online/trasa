import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Trash2, Star, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const MyRoutes = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const { data: publishedRoutes } = useQuery({
    queryKey: ["my-routes-published", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(`
          *,
          pins (*),
          likes (user_id),
          comments (id)
        `)
        .eq("user_id", user?.id)
        .eq("status", "published")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: draftRoutes } = useQuery({
    queryKey: ["my-routes-draft", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(`
          *,
          pins (*),
          likes (user_id),
          comments (id)
        `)
        .eq("user_id", user?.id)
        .eq("status", "draft")
        .order("created_at", { ascending: false});

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (routeId: string) => {
      const { error } = await supabase.from("routes").delete().eq("id", routeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-routes-published"] });
      queryClient.invalidateQueries({ queryKey: ["my-routes-draft"] });
      toast({ title: "Trasa została usunięta" });
    },
  });

  const RouteItem = ({ route }: { route: any }) => {
    const [pinsExpanded, setPinsExpanded] = useState(false);
    const MAX_VISIBLE_PINS = 4;
    
    // Sort pins by pin_order for consistent display
    const sortedPins = route.pins?.slice().sort((a: any, b: any) => a.pin_order - b.pin_order) || [];
    
    // Calculate average rating only from attraction pins (not transport pins)
    const attractionPins = sortedPins.filter((pin: any) => !pin.is_transport && pin.rating !== null);
    const avgRating =
      attractionPins.length > 0
        ? attractionPins.reduce((acc: number, pin: any) => acc + pin.rating, 0) / attractionPins.length
        : 0;
    
    const displayPins = pinsExpanded ? sortedPins : sortedPins.slice(0, MAX_VISIBLE_PINS);

    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden hover:border-foreground/20 transition-all duration-300">
        {/* Clickable Header Section */}
        <div 
          className="p-4 border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => navigate(`/route/${route.id}`)}
        >
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="text-base font-bold leading-tight flex-1">
              {route.title}
            </h3>
            <div className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-lg flex-shrink-0">
              <Star className="h-4 w-4 fill-star text-star" />
              <span className="font-bold text-sm">{Math.round(avgRating * 10) / 10}</span>
            </div>
          </div>

          {route.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed mb-2">
              {route.description}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {sortedPins.length > 0 && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                <span>{sortedPins.length} {sortedPins.length === 1 ? 'przystanek' : 'przystanki'}</span>
              </div>
            )}
          </div>
        </div>

        {/* Pins Section - Vertical List */}
        {sortedPins.length > 0 && (
          <div className="divide-y divide-border/50">
            {displayPins.map((pin: any, index: number) => (
              <div 
                key={pin.id} 
                className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => navigate(`/route/${route.id}`)}
              >
                <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold">{index + 1}</span>
                </div>
                <span className="text-sm font-medium flex-1 truncate">
                  {pin.place_name || pin.address}
                </span>
                {pin.rating > 0 && (
                  <div className="flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded">
                    <Star className="h-3 w-3 fill-star text-star" />
                    <span className="text-xs font-semibold">{pin.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
            ))}
            {sortedPins.length > MAX_VISIBLE_PINS && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setPinsExpanded(!pinsExpanded);
                }}
                className="w-full p-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              >
                {pinsExpanded ? "Zwiń" : `Pokaż +${sortedPins.length - MAX_VISIBLE_PINS} więcej`}
              </button>
            )}
          </div>
        )}

        {/* Footer Section with Actions */}
        <div className="p-3 bg-muted/20 border-t border-border/50">
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => navigate(`/route/${route.id}`)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Zobacz
            </Button>
            <Button
              variant="default"
              className="flex-1"
              onClick={() => navigate(`/edit/${route.id}`)}
            >
              Edytuj
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => deleteMutation.mutate(route.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  if (loading || !user) return null;

  return (
    <AppLayout>
      <PageHeader title="TRASA" />
      
      <div className="p-4">
        <Tabs defaultValue="published" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="published">
              Opublikowane trasy ({publishedRoutes?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="draft">
              Robocze trasy ({draftRoutes?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="published" className="space-y-4 mt-4">
            {publishedRoutes?.map((route) => (
              <RouteItem key={route.id} route={route} />
            ))}
            {publishedRoutes?.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Nie masz jeszcze opublikowanych tras
              </p>
            )}
          </TabsContent>

          <TabsContent value="draft" className="space-y-4 mt-4">
            {draftRoutes?.map((route) => (
              <RouteItem key={route.id} route={route} />
            ))}
            {draftRoutes?.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                Nie masz roboczych tras
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default MyRoutes;
