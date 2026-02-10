import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Share2, Pencil, FolderOpen } from "lucide-react";
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
            pins (id, place_name, address, image_url, images, tags, rating, pin_order, expectation_met, pros, cons, trip_role, one_liner, recommended_for),
            likes (user_id),
            comments (id)
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
    (r.pins || []).filter((p: any) => p.rating > 0).map((p: any) => p.rating)
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

  const heroImage =
    folder.cover_image_url ||
    routes.flatMap((r: any) => r.pins || []).find((p: any) => p.image_url)?.image_url ||
    null;

  // Tags from all pins
  const allRec = routes.flatMap((r: any) => (r.pins || []).flatMap((p: any) => p.recommended_for || []));
  const allPros = routes.flatMap((r: any) => (r.pins || []).flatMap((p: any) => p.pros || []));
  const uniqueTags = [...new Set([...allRec, ...allPros])].slice(0, 6);

  return (
    <div className="max-w-lg mx-auto pb-24">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border/50 px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={() => navigate(-1)} className="p-1 -ml-1 hover:bg-muted rounded-md transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-medium truncate">{folder.name}</h1>
          <p className="text-[11px] text-muted-foreground">
            {routes.length} {routes.length === 1 ? 'dzień' : 'dni'} · {totalPins} miejsc
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={handleShare} className="p-2 hover:bg-muted rounded-md transition-colors">
            <Share2 className="h-4 w-4" />
          </button>
          {isOwner && (
            <button onClick={() => navigate(`/edit-folder/${folder.id}`)} className="p-2 hover:bg-muted rounded-md transition-colors">
              <Pencil className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Hero */}
      {heroImage && (
        <div className="relative aspect-[16/10] w-full overflow-hidden">
          <img src={heroImage} alt={folder.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h2 className="text-xl font-bold text-white leading-tight uppercase">{folder.name}</h2>
            <div className="flex items-center gap-3 text-xs text-white/80 mt-1">
              <span>⏱ {routes.length} dni</span>
              <span>📍 {totalPins} miejsc</span>
              {avgRating > 0 && <span>⭐ {avgRating.toFixed(1)}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Info */}
      <div className="px-4 pt-4 space-y-4">
        {folder.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{folder.description}</p>
        )}

        {uniqueTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {uniqueTags.map((tag: string, i: number) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-medium">
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Routes list */}
      <div className="p-4 space-y-3">
        {visibleRoutes.map((route: any, idx: number) => {
          const pinCount = route.pins?.length || 0;
          const mustSeeCount = (route.pins || []).filter((p: any) => p.trip_role === "must_see").length;
          const heroPin = (route.pins || []).find((p: any) => p.image_url);

          return (
            <div
              key={route.id}
              className="bg-card border border-border/50 rounded-xl overflow-hidden cursor-pointer hover:border-foreground/20 transition-all"
              onClick={() => navigate(`/route/${route.id}`)}
            >
              {heroPin?.image_url && (
                <div className="h-32 w-full">
                  <img src={heroPin.image_url} alt={route.title} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="bg-foreground text-background rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold">{idx + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm leading-tight truncate">{route.title}</h3>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>📍 {pinCount} miejsc</span>
                        {mustSeeCount > 0 && <span>⭐ {mustSeeCount} obowiązkowych</span>}
                        {route.status === 'draft' && (
                          <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium">Robocza</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview top 2 pins */}
                {(() => {
                  const topPins = (route.pins || [])
                    .sort((a: any, b: any) => {
                      if (a.trip_role === "must_see" && b.trip_role !== "must_see") return -1;
                      if (b.trip_role === "must_see" && a.trip_role !== "must_see") return 1;
                      return a.pin_order - b.pin_order;
                    })
                    .slice(0, 2);
                  return topPins.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {topPins.map((pin: any) => (
                        <p key={pin.id} className="text-xs text-muted-foreground truncate">
                          <span className="text-foreground font-medium">{pin.place_name || pin.address}</span>
                          {pin.one_liner && <span> – {pin.one_liner}</span>}
                        </p>
                      ))}
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          );
        })}

        {/* Add day button */}
        {isOwner && (
          <Button
            variant="outline"
            className="w-full text-[13px]"
            onClick={() => navigate(`/create?folder=${folder.id}`)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Dodaj kolejny dzień
          </Button>
        )}
      </div>
    </div>
  );
};

export default FolderDetails;
