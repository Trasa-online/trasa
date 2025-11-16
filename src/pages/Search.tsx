import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Search as SearchIcon, Map, Users, MapPin } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import RouteCard from "@/components/route/RouteCard";

type TabType = "all" | "routes" | "users" | "places";

const Search = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["search", searchQuery, activeTab],
    queryFn: async () => {
      if (!searchQuery.trim()) return null;

      if (activeTab === "routes" || activeTab === "all") {
        const { data: routes, error } = await supabase
          .from("routes")
          .select(`
            *,
            profiles:user_id (username, avatar_url),
            pins (*),
            likes (user_id),
            comments (id)
          `)
          .eq("status", "published")
          .or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) throw error;
        return { routes };
      }

      return null;
    },
    enabled: searchQuery.length > 0,
  });

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
            <div className="space-y-4">
              {isLoading && (
                <p className="text-center text-muted-foreground py-8">Wyszukiwanie...</p>
              )}

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

              {!isLoading && searchResults?.routes?.length === 0 && (
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
