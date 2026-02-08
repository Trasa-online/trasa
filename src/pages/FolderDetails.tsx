import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Star, MapPin, Plus, Share2, Pencil, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const FolderDetails = () => {
  const { id } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const { data: folder, isLoading } = useQuery({
    queryKey: ["folder-details", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_folders")
        .select(`
          *,
          routes (
            *,
            pins (id, rating, is_transport, pin_order)
          )
        `)
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  if (loading || !user) return null;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Ładowanie...</div>
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <FolderOpen className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Folder nie został znaleziony</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Wróć</Button>
      </div>
    );
  }

  const isOwner = folder.user_id === user.id;
  const routes = (folder.routes || []).slice().sort((a: any, b: any) => (a.folder_order || 0) - (b.folder_order || 0));
  const visibleRoutes = isOwner ? routes : routes.filter((r: any) => r.status === "published");

  const totalPins = routes.reduce((acc: number, r: any) => acc + (r.pins?.length || 0), 0);
  const allRatings = routes.flatMap((r: any) =>
    (r.pins || []).filter((p: any) => !p.is_transport && p.rating > 0).map((p: any) => p.rating)
  );
  const avgRating = allRatings.length > 0
    ? allRatings.reduce((a: number, b: number) => a + b, 0) / allRatings.length
    : 0;

  const handleShare = async () => {
    const url = `${window.location.origin}/folder/${folder.id}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: folder.name, url });
      } catch {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link skopiowany do schowka" });
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link skopiowany do schowka" });
    }
  };

  return (
    <div className="max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b border-border p-4 flex items-center gap-4 z-10">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl font-semibold flex-1 truncate">{folder.name}</h1>
        <div className="flex items-center gap-1">
          <button onClick={handleShare} className="p-2 hover:bg-accent rounded-lg transition-colors">
            <Share2 className="h-5 w-5" />
          </button>
          {isOwner && (
            <button 
              onClick={() => navigate(`/edit-folder/${folder.id}`)} 
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <Pencil className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Cover */}
      {folder.cover_image_url && (
        <div className="h-48 bg-muted">
          <img src={folder.cover_image_url} alt={folder.name} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Info */}
      <div className="p-4 space-y-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-xl font-bold mb-2">{folder.name}</h2>
          {folder.description && (
            <p className="text-sm text-muted-foreground leading-relaxed mb-3">{folder.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span>{routes.length} {routes.length === 1 ? 'dzień' : 'dni'}</span>
            <span>·</span>
            <div className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              <span>{totalPins} pinezek</span>
            </div>
            {avgRating > 0 && (
              <>
                <span>·</span>
                <div className="flex items-center gap-1">
                  <Star className="h-3.5 w-3.5 fill-star text-star" />
                  <span className="font-semibold">{(Math.round(avgRating * 10) / 10).toFixed(1)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Routes list */}
        <div className="space-y-3">
          {visibleRoutes.map((route: any, idx: number) => {
            const pinCount = route.pins?.length || 0;
            const attractionPins = (route.pins || []).filter((p: any) => !p.is_transport && p.rating > 0);
            const routeAvg = attractionPins.length > 0
              ? attractionPins.reduce((a: number, p: any) => a + p.rating, 0) / attractionPins.length
              : 0;

            return (
              <div
                key={route.id}
                className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-foreground/20 transition-all"
                onClick={() => navigate(`/route/${route.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold">{idx + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm leading-tight truncate">{route.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          <span>{pinCount} pinezek</span>
                        </div>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          route.status === 'published' 
                            ? 'bg-primary/10 text-primary' 
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {route.status === 'published' ? 'Opublikowana' : 'Robocza'}
                        </span>
                      </div>
                    </div>
                  </div>
                  {routeAvg > 0 && (
                    <div className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded flex-shrink-0">
                      <Star className="h-3 w-3 fill-star text-star" />
                      <span className="text-xs font-semibold">{routeAvg.toFixed(1)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Add day button (owner only) */}
        {isOwner && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate(`/create?folder=${folder.id}`)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Dodaj kolejny dzień
          </Button>
        )}
      </div>
    </div>
  );
};

export default FolderDetails;
