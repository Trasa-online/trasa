import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Star, MapPin, Bookmark, ArrowRight, UtensilsCrossed, Coffee, ShoppingBag, Gift, Mountain, Waves, Share2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getPinImage } from "@/lib/pinPlaceholders";

interface RouteCardProps {
  route: any;
}

const RouteCard = ({ route }: RouteCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const [pinsExpanded, setPinsExpanded] = useState(false);
  const MAX_VISIBLE_PINS = 4;
  
  // Sort pins by pin_order for consistent display
  const sortedPins = route.pins?.slice().sort((a: any, b: any) => a.pin_order - b.pin_order) || [];
  
  // Use the rating stored in the database (calculated from attraction pins only)
  const averageRating = route.rating || 0;

  // Get pin visitors with profiles and ratings for all pins on this route
  const { data: pinVisitorsMap = {} } = useQuery({
    queryKey: ["route-card-pin-visitors", route.id],
    queryFn: async () => {
      const pinIds = sortedPins.map((p: any) => p.id);
      if (pinIds.length === 0) return {};

      const { data, error } = await supabase
        .from("pin_visits")
        .select("pin_id, user_id, created_at, image_url, rating, profiles:user_id (username, avatar_url)")
        .in("pin_id", pinIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Group by pin_id with visitor details (max 3 per pin), images and ratings
      const visitorsMap: Record<string, { count: number; visitors: any[]; images: string[]; avgRating: number }> = {};
      const uniqueByPin: Record<string, Map<string, any>> = {};
      const imagesByPin: Record<string, string[]> = {};
      const ratingsByPin: Record<string, number[]> = {};
      
      data?.forEach((visit: any) => {
        if (!uniqueByPin[visit.pin_id]) {
          uniqueByPin[visit.pin_id] = new Map();
          imagesByPin[visit.pin_id] = [];
          ratingsByPin[visit.pin_id] = [];
        }
        if (!uniqueByPin[visit.pin_id].has(visit.user_id)) {
          uniqueByPin[visit.pin_id].set(visit.user_id, {
            user_id: visit.user_id,
            profiles: visit.profiles,
          });
        }
        // Collect all images (not just unique per user)
        if (visit.image_url && !imagesByPin[visit.pin_id].includes(visit.image_url)) {
          imagesByPin[visit.pin_id].push(visit.image_url);
        }
        // Collect ratings for average calculation
        if (visit.rating && visit.rating > 0) {
          ratingsByPin[visit.pin_id].push(visit.rating);
        }
      });
      
      Object.entries(uniqueByPin).forEach(([pinId, usersMap]) => {
        const visitors = Array.from(usersMap.values()).slice(0, 3);
        const ratings = ratingsByPin[pinId] || [];
        const avgRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : 0;
        visitorsMap[pinId] = {
          count: usersMap.size,
          visitors,
          images: imagesByPin[pinId] || [],
          avgRating,
        };
      });
      
      return visitorsMap;
    },
    enabled: sortedPins.length > 0,
  });


  // Fetch likes with polling for real-time updates
  const { data: likesData } = useQuery({
    queryKey: ["route-card-likes", route.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("likes")
        .select("user_id")
        .eq("route_id", route.id);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000, // Fallback polling every 30 seconds
  });

  // Supabase Realtime subscription for instant like updates
  useEffect(() => {
    const channel = supabase
      .channel(`likes-${route.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'likes',
          filter: `route_id=eq.${route.id}`
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["route-card-likes", route.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [route.id, queryClient]);

  const isLiked = likesData?.some((like: any) => like.user_id === user?.id) || false;
  const likesCount = likesData?.length || 0;

  // Like/unlike route mutation
  const likeRouteMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Must be logged in");

      if (isLiked) {
        const { error } = await supabase
          .from("likes")
          .delete()
          .eq("route_id", route.id)
          .eq("user_id", user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("likes")
          .insert({ route_id: route.id, user_id: user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-card-likes", route.id] });
      queryClient.invalidateQueries({ queryKey: ["feed-routes"] });
      queryClient.invalidateQueries({ queryKey: ["route", route.id] });
      queryClient.invalidateQueries({ queryKey: ["route-likes", route.id] });
    },
    onError: () => {
      toast.error("Nie udało się polubić trasy");
    },
  });

  const handleLike = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Musisz być zalogowany");
      return;
    }
    likeRouteMutation.mutate();
  };

  const handleCommentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/route/${route.id}#comments`);
  };

  const { data: isSaved = false } = useQuery({
    queryKey: ["is-saved", route.id, user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      const { data, error } = await supabase
        .from("saved_routes")
        .select("*")
        .eq("route_id", route.id)
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    },
    enabled: !!user,
  });

  // Get save count for the route
  const { data: saveCount = 0 } = useQuery({
    queryKey: ["save-count", route.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("saved_routes")
        .select("*", { count: "exact", head: true })
        .eq("route_id", route.id);

      if (error) throw error;
      return count || 0;
    },
  });

  // Save/unsave route mutation
  const saveRouteMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Must be logged in");

      if (isSaved) {
        // Unsave
        const { error } = await supabase
          .from("saved_routes")
          .delete()
          .eq("route_id", route.id)
          .eq("user_id", user.id);

        if (error) throw error;
      } else {
        // Save
        const { error } = await supabase
          .from("saved_routes")
          .insert({
            route_id: route.id,
            user_id: user.id,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["is-saved", route.id] });
      queryClient.invalidateQueries({ queryKey: ["saved-routes"] });
      toast.success(isSaved ? "Usunięto z zapisanych" : "Zapisano trasę");
    },
    onError: () => {
      toast.error("Nie udało się zapisać trasy");
    },
  });

  const handleSave = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      toast.error("Musisz być zalogowany");
      return;
    }
    saveRouteMutation.mutate();
  };

  const handleCardClick = () => {
    navigate(`/route/${route.id}`);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/route/${route.id}`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: route.title,
          text: route.description || `Sprawdź trasę: ${route.title}`,
          url: url,
        });
      } catch (err) {
        // User cancelled or share failed, fallback to clipboard
        await navigator.clipboard.writeText(url);
        toast.success("Link skopiowany do schowka");
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link skopiowany do schowka");
    }
  };

  return (
    <div 
      onClick={handleCardClick}
      className="bg-card border border-border rounded-xl overflow-hidden hover:border-foreground/20 transition-all duration-300 cursor-pointer group hover:shadow-lg"
    >
      {/* Header Section */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <Avatar 
              className="h-10 w-10 ring-2 ring-border cursor-pointer hover:ring-primary transition-all"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/profile/${route.user_id}`);
              }}
            >
              <AvatarImage src={route.profiles?.avatar_url} />
              <AvatarFallback className="text-xs">
                {route.profiles?.username?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p 
                className="font-semibold text-sm cursor-pointer hover:text-primary transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/profile/${route.user_id}`);
                }}
              >
                {route.profiles?.username}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(route.created_at), "dd MMM yyyy")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleShare}
              className="p-2 hover:bg-accent rounded-lg transition-colors"
            >
              <Share2 className="h-5 w-5" />
            </button>
            <button
              onClick={handleSave}
              disabled={saveRouteMutation.isPending}
              className="p-2 hover:bg-accent rounded-lg transition-colors disabled:opacity-50"
            >
              <Bookmark className={`h-5 w-5 transition-all ${isSaved ? "fill-foreground" : ""}`} />
            </button>
          </div>
        </div>

        {/* Title and Rating */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-bold leading-tight flex-1 group-hover:text-foreground/90 transition-colors">
              {route.title}
            </h3>
            <div className="flex items-center gap-1.5 bg-muted px-2.5 py-1 rounded-lg flex-shrink-0">
              <Star className="h-4 w-4 fill-star text-star" />
              <span className="font-bold text-sm">{Math.round(averageRating * 10) / 10}</span>
            </div>
          </div>
          
          {route.description && (
            <p className="text-sm text-muted-foreground line-clamp-4 leading-relaxed">
              {route.description}
            </p>
          )}

          {/* Tags Section */}
          {(() => {
            const allTags = sortedPins.flatMap((pin: any) => pin.tags || []);
            const uniqueTags = Array.from(new Set(allTags)) as string[];
            const MAX_VISIBLE_TAGS = 6;
            const displayTags = tagsExpanded ? uniqueTags : uniqueTags.slice(0, MAX_VISIBLE_TAGS);
            const remainingCount = uniqueTags.length - MAX_VISIBLE_TAGS;
            
            const getTagIcon = (tag: string) => {
              const tagLower = tag.toLowerCase();
              if (tagLower === 'restauracja' || tagLower === 'jedzenie') return UtensilsCrossed;
              if (tagLower === 'kawiarnia' || tagLower === 'kawa' || tagLower === 'herbata') return Coffee;
              if (tagLower === 'zakupy') return ShoppingBag;
              if (tagLower === 'pamiątki') return Gift;
              if (tagLower === 'góry') return Mountain;
              if (tagLower === 'morze') return Waves;
              return null;
            };

            return uniqueTags.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t border-border/30 transition-all duration-300">
                {displayTags.map((tag: string, idx: number) => {
                  const TagIcon = getTagIcon(tag);
                  return (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/search?tag=${encodeURIComponent(tag)}`);
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
                    >
                      {TagIcon && <TagIcon className="h-3.5 w-3.5" />}
                      <span>{tag}</span>
                    </button>
                  );
                })}
                {remainingCount > 0 && !tagsExpanded && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTagsExpanded(true);
                    }}
                    className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                  >
                    +{remainingCount}
                  </button>
                )}
                {tagsExpanded && remainingCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setTagsExpanded(false);
                    }}
                    className="inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                  >
                    Zwiń
                  </button>
                )}
              </div>
            ) : null;
          })()}

          {/* Metadata */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
            {sortedPins.length > 0 && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                <span>{sortedPins.length} {sortedPins.length === 1 ? 'przystanek' : 'przystanki'}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Pins Section */}
      {sortedPins.length > 0 && (
        <div className="divide-y divide-border/50">
          {(pinsExpanded ? sortedPins : sortedPins.slice(0, MAX_VISIBLE_PINS)).map((pin: any, index: number) => {
            const pinVisitorData = pinVisitorsMap[pin.id] || { count: 0, visitors: [], images: [], avgRating: 0 };
            const { count: visitorCount, visitors } = pinVisitorData;
            return (
              <div 
                key={pin.id} 
                className="p-3 hover:bg-accent/50 transition-all cursor-pointer group/pin"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/pin/${pin.id}`);
                }}
              >
                <div className="flex gap-3">
                  <div className="flex-shrink-0 relative group/img">
                    <img
                      src={getPinImage(pin)}
                      alt={pin.place_name}
                      className="w-20 h-20 object-cover rounded-lg ring-1 ring-border"
                    />
                    <div className="absolute top-2 left-2 bg-background/95 backdrop-blur-sm rounded-full w-6 h-6 flex items-center justify-center ring-1 ring-border">
                      <span className="text-xs font-bold">{index + 1}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h4 className="font-semibold text-sm leading-tight flex-1 min-w-0 group-hover/pin:text-primary transition-colors">{pin.place_name || pin.address}</h4>
                      {pin.rating && (
                        <div className="flex items-center gap-1 bg-muted/50 px-2 py-0.5 rounded flex-shrink-0">
                          <Star className="h-3 w-3 fill-star text-star" />
                          <span className="font-semibold text-xs">{pin.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    {pin.place_name && pin.address && pin.address !== pin.place_name && (
                      <p className="text-xs text-muted-foreground mb-1">{pin.address}</p>
                    )}
                    {pin.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {pin.description}
                      </p>
                    )}
                    {visitorCount > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex -space-x-1.5">
                          {visitors.map((visitor: any) => (
                            <Avatar key={visitor.user_id} className="h-5 w-5 ring-2 ring-background">
                              <AvatarImage src={visitor.profiles?.avatar_url || ""} />
                              <AvatarFallback className="text-[8px] bg-muted">
                                {visitor.profiles?.username?.charAt(0).toUpperCase() || "?"}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {visitorCount > 3 && (
                            <div className="h-5 w-5 ring-2 ring-background rounded-full bg-muted flex items-center justify-center">
                              <span className="text-[8px] font-bold">+{visitorCount - 3}</span>
                            </div>
                          )}
                        </div>
                        {pinVisitorData.avgRating > 0 && (
                          <div className="flex items-center gap-0.5 text-xs">
                            <Star className="h-3 w-3 fill-star text-star" />
                            <span className="font-medium">{pinVisitorData.avgRating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 flex items-center opacity-0 group-hover/pin:opacity-100 transition-opacity">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </div>
            );
          })}
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

      {/* Footer Section */}
      <div className="px-4 py-3 bg-muted/30 border-t border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5">
            <button 
              onClick={handleLike}
              disabled={likeRouteMutation.isPending}
              className="flex items-center gap-2 text-muted-foreground hover:text-red-500 transition-all duration-200 group/btn disabled:opacity-50"
            >
              <Heart className={`h-[18px] w-[18px] group-hover/btn:scale-110 transition-transform ${isLiked ? "fill-red-500 text-red-500" : ""}`} />
              <span className="text-sm font-semibold tabular-nums">{likesCount}</span>
            </button>
            <button 
              onClick={handleCommentClick}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all duration-200 group/btn"
            >
              <MessageCircle className="h-[18px] w-[18px] group-hover/btn:scale-110 transition-transform" />
              <span className="text-sm font-semibold tabular-nums">{route.comments?.length || 0}</span>
            </button>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Bookmark className="h-[18px] w-[18px]" />
              <span className="text-sm font-semibold tabular-nums">{saveCount}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
            <span>Zobacz</span>
            <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default RouteCard;
