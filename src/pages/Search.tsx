import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search as SearchIcon, Map, Users, MapPin, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import RouteCard from "@/components/route/RouteCard";

type TabType = "all" | "routes" | "users" | "places";

const Search = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const tagFilter = searchParams.get("tag");

  // Set initial search query from URL if tag is present
  useEffect(() => {
    if (tagFilter && !searchQuery) {
      setActiveTab("routes");
    }
  }, [tagFilter]);

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["search", searchQuery, activeTab, tagFilter],
    queryFn: async () => {
      if (!searchQuery.trim() && !tagFilter) return null;

      const results: any = {};

      // Wyszukiwanie tras
      if (activeTab === "routes" || activeTab === "all") {
        let query = supabase
          .from("routes")
          .select(`
            *,
            profiles:user_id (username, avatar_url),
            pins (*),
            likes (user_id),
            comments (id)
          `)
          .eq("status", "published");

        // Add text search if query exists
        if (searchQuery.trim()) {
          query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
        }

        const { data: routes, error } = await query
          .order("created_at", { ascending: false })
          .limit(100);

        if (error) throw error;

        // Filter by tag if tag filter is active
        let filteredRoutes = routes;
        if (tagFilter && routes) {
          filteredRoutes = routes.filter((route: any) => {
            const routeTags = route.pins?.flatMap((pin: any) => pin.tags || []) || [];
            return routeTags.some((tag: string) => tag.toLowerCase() === tagFilter.toLowerCase());
          });
        }

        results.routes = filteredRoutes?.slice(0, 20);
      }

      // Wyszukiwanie użytkowników
      if (activeTab === "users" || activeTab === "all") {
        const { data: users, error } = await supabase
          .from("profiles")
          .select("*")
          .ilike("username", `%${searchQuery}%`)
          .limit(20);

        if (error) throw error;
        results.users = users;
      }

      // Wyszukiwanie miejsc
      if (activeTab === "places" || activeTab === "all") {
        const { data: places, error } = await supabase
          .from("pins")
          .select(`
            *,
            routes!inner (
              *,
              profiles:user_id (username, avatar_url)
            )
          `)
          .eq("routes.status", "published")
          .or(`place_name.ilike.%${searchQuery}%,address.ilike.%${searchQuery}%`)
          .limit(20);

        if (error) throw error;
        results.places = places;
      }

      return results;
    },
    enabled: searchQuery.length > 0 || !!tagFilter,
  });

  const clearTagFilter = () => {
    setSearchParams({});
  };

  const showEmptyState = !searchQuery;

  return (
    <AppLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="sticky top-0 bg-background z-10 border-b border-border">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-accent rounded-lg"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h1 className="text-xl font-semibold">Szukaj</h1>
            </div>

            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Szukaj tras, użytkowników, miejsc..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Active tag filter */}
            {tagFilter && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Filtrowanie po tagu:</span>
                <Badge variant="secondary" className="flex items-center gap-2">
                  {tagFilter}
                  <button
                    onClick={clearTagFilter}
                    className="hover:bg-background/50 rounded-full p-0.5 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              </div>
            )}

            {/* Tabs */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setActiveTab("all")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeTab === "all"
                    ? "bg-foreground text-background"
                    : "bg-secondary text-foreground hover:bg-secondary/80"
                }`}
              >
                Wszystko
              </button>
              <button
                onClick={() => setActiveTab("routes")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeTab === "routes"
                    ? "bg-foreground text-background"
                    : "bg-secondary text-foreground hover:bg-secondary/80"
                }`}
              >
                Trasy
              </button>
              <button
                onClick={() => setActiveTab("users")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeTab === "users"
                    ? "bg-foreground text-background"
                    : "bg-secondary text-foreground hover:bg-secondary/80"
                }`}
              >
                Użytkownicy
              </button>
              <button
                onClick={() => setActiveTab("places")}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                  activeTab === "places"
                    ? "bg-foreground text-background"
                    : "bg-secondary text-foreground hover:bg-secondary/80"
                }`}
              >
                Miejsca
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {showEmptyState ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-6">
                <MapPin className="h-12 w-12 text-muted-foreground" />
              </div>
              
              <h2 className="text-xl font-semibold mb-2">Szukaj czegokolwiek</h2>
              <p className="text-muted-foreground mb-12 max-w-sm">
                Odkrywaj trasy, użytkowników i miejsca w aplikacji TRASA
              </p>

              {/* Quick actions */}
              <div className="w-full max-w-md space-y-4">
                <button
                  onClick={() => setActiveTab("routes")}
                  className="w-full flex items-start gap-4 p-4 rounded-xl hover:bg-accent transition-colors text-left"
                >
                  <Map className="h-6 w-6 text-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1">Trasy</h3>
                    <p className="text-sm text-muted-foreground">
                      Odkrywaj trasy stworzone przez innych użytkowników
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab("users")}
                  className="w-full flex items-start gap-4 p-4 rounded-xl hover:bg-accent transition-colors text-left"
                >
                  <Users className="h-6 w-6 text-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1">Użytkownicy</h3>
                    <p className="text-sm text-muted-foreground">
                      Znajdź i obserwuj innych podróżników
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab("places")}
                  className="w-full flex items-start gap-4 p-4 rounded-xl hover:bg-accent transition-colors text-left"
                >
                  <MapPin className="h-6 w-6 text-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold mb-1">Miejsca</h3>
                    <p className="text-sm text-muted-foreground">
                      Eksploruj konkretne miejsca i atrakcje
                    </p>
                  </div>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {isLoading && (
                <p className="text-center text-muted-foreground py-8">Wyszukiwanie...</p>
              )}

              {/* Wyniki tras */}
              {searchResults?.routes && searchResults.routes.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Trasy</h3>
                  <div className="space-y-4">
                    {searchResults.routes.map((route: any) => (
                      <RouteCard key={route.id} route={route} />
                    ))}
                  </div>
                </div>
              )}

              {/* Wyniki użytkowników */}
              {searchResults?.users && searchResults.users.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Użytkownicy</h3>
                  <div className="space-y-3">
                    {searchResults.users.map((user: any) => (
                      <div
                        key={user.id}
                        onClick={() => navigate(`/profile/${user.id}`)}
                        className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:bg-accent cursor-pointer transition-colors"
                      >
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                          {user.avatar_url ? (
                            <img src={user.avatar_url} alt={user.username} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <span className="text-lg font-semibold">{user.username?.[0]?.toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold">{user.username}</p>
                          {user.bio && (
                            <p className="text-sm text-muted-foreground line-clamp-1">{user.bio}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Wyniki miejsc */}
              {searchResults?.places && searchResults.places.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">Miejsca</h3>
                  <div className="space-y-3">
                    {searchResults.places.map((pin: any) => (
                      <div
                        key={pin.id}
                        onClick={() => navigate(`/route/${pin.routes.id}`)}
                        className="flex gap-3 p-4 bg-card border border-border rounded-xl hover:bg-accent cursor-pointer transition-colors"
                      >
                        <img
                          src={pin.image_url || '/placeholder.svg'}
                          alt={pin.place_name}
                          className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold mb-1">{pin.place_name}</h4>
                          <p className="text-xs text-muted-foreground mb-1">{pin.address}</p>
                          <p className="text-xs text-muted-foreground">
                            Z trasy: {pin.routes.title}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!isLoading && 
               !searchResults?.routes?.length && 
               !searchResults?.users?.length && 
               !searchResults?.places?.length && (
                <p className="text-center text-muted-foreground py-8">
                  Nie znaleziono wyników
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Search;
