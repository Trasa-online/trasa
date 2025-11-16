import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StarRating from "@/components/route/StarRating";
import { MapPin, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import PageTransition from "@/components/PageTransition";

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
    const avgRating =
      route.pins?.length > 0
        ? route.pins.reduce((acc: number, pin: any) => acc + (pin.rating || 0), 0) /
          route.pins.length
        : 0;

    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-semibold">{route.title}</h3>
              <StarRating rating={Math.round(avgRating * 10) / 10} />
            </div>
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {route.pins?.length || 0} pinezka
            </p>
          </div>
        </div>

        {route.pins?.slice(0, 1).map((pin: any) => (
          <div key={pin.id} className="flex gap-3 mb-3">
            {pin.image_url ? (
              <img
                src={pin.image_url}
                alt={pin.place_name}
                className="w-24 h-24 object-cover rounded-lg"
              />
            ) : (
              <div className="w-24 h-24 bg-muted rounded-lg" />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-medium">{pin.place_name}</h4>
              <p className="text-xs text-muted-foreground">{pin.address}</p>
            </div>
          </div>
        ))}

        <div className="flex gap-2">
          <Button
            variant="default"
            className="flex-1"
            onClick={() => navigate(`/edit/${route.id}`)}
          >
            Edytuj trasę
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
    );
  };

  if (loading || !user) return null;

  return (
    <PageTransition>
      <AppLayout>
        <div className="p-4">
          <h1 className="text-2xl font-bold mb-4">TRASA</h1>

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
    </PageTransition>
  );
};

export default MyRoutes;
