import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Search as SearchIcon, Map, Users, MapPin, X, UtensilsCrossed, Coffee, ShoppingBag, Gift, Mountain, Waves, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { PageHeader } from "@/components/layout/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import RouteCard from "@/components/route/RouteCard";

type TabType = "all" | "routes" | "users" | "places";

// Predefined tags with icons
const PREDEFINED_TAGS = [
  { name: "Restauracja", icon: UtensilsCrossed },
  { name: "Kawiarnia", icon: Coffee },
  { name: "Jedzenie", icon: UtensilsCrossed },
  { name: "Kawa", icon: Coffee },
  { name: "Herbata", icon: Coffee },
  { name: "Zakupy", icon: ShoppingBag },
  { name: "Pamiątki", icon: Gift },
  { name: "Góry", icon: Mountain },
  { name: "Morze", icon: Waves },
];

const Search = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const urlTagFilter = searchParams.get("tag");

  // Initialize selected tags from URL
  useEffect(() => {
    if (urlTagFilter) {
      setSelectedTags([urlTagFilter]);
      setActiveTab("routes");
      // Clear URL param after loading
      setSearchParams({});
    }
  }, [urlTagFilter]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const clearAllTags = () => {
    setSelectedTags([]);
  };

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ["search", searchQuery, activeTab, selectedTags],
    queryFn: async () => {
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

        // Filter by selected tags if any
        let filteredRoutes = routes;
        if (selectedTags.length > 0 && routes) {
          filteredRoutes = routes.filter((route: any) => {
            const routeTags = route.pins?.flatMap((pin: any) => pin.tags || []) || [];
            // Route must have ALL selected tags
            return selectedTags.every(selectedTag => 
              routeTags.some((tag: string) => tag.toLowerCase() === selectedTag.toLowerCase())
            );
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

      // Wyszukiwanie miejsc (including translations)
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
          .limit(50);

        if (error) throw error;
        
        // Filter client-side for translations
        const filteredPlaces = places?.filter((pin: any) => {
          const matchesBasic = 
            pin.place_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            pin.address?.toLowerCase().includes(searchQuery.toLowerCase());
          
          if (matchesBasic) return true;
          
          // Check translations
          if (pin.name_translations) {
            const translations = Object.values(pin.name_translations) as string[];
            return translations.some(t => 
              t?.toLowerCase().includes(searchQuery.toLowerCase())
            );
          }
          return false;
        });
        
        results.places = filteredPlaces?.slice(0, 20);
      }

      return results;
    },
    enabled: true, // Always enabled to show results on load
  });

  return (
    <div className="overflow-x-hidden">
      <PageHeader 
        title="Szukaj" 
        showBack
        onBackClick={() => navigate("/")}
      />
      
      <div className="sticky top-0 bg-background z-10 border-b border-border pt-2 pb-4 px-4 overflow-hidden">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Szukaj..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          
          <Sheet open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-9">
                <Filter className="h-4 w-4" />
                Filtruj po tagach
                {selectedTags.length > 0 && (
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-5 text-xs">
                    {selectedTags.length}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filtruj po tagach</SheetTitle>
                <SheetDescription>
                  Wybierz tagi aby znaleźć trasy które Cię interesują
                </SheetDescription>
              </SheetHeader>
              
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Wybrane tagi ({selectedTags.length})</span>
                  {selectedTags.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearAllTags}>
                      Wyczyść wszystkie
                    </Button>
                  )}
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {PREDEFINED_TAGS.map((tag) => {
                    const isSelected = selectedTags.includes(tag.name);
                    const Icon = tag.icon;
                    return (
                      <button
                        key={tag.name}
                        onClick={() => toggleTag(tag.name)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                          isSelected
                            ? "bg-foreground text-background border-foreground"
                            : "bg-background text-foreground border-border hover:bg-accent"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {tag.name}
                      </button>
                    );
                  })}
                </div>

                {selectedTags.length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm text-muted-foreground mb-2">Aktywne filtry:</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="flex items-center gap-1.5">
                          {tag}
                          <button
                            onClick={() => toggleTag(tag)}
                            className="hover:bg-background/50 rounded-full p-0.5 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mt-4 overflow-x-auto scrollbar-hide -mx-4 px-4">
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

      {/* Content */}
      <div className="p-4">
        {!searchQuery && selectedTags.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
              <MapPin className="h-6 w-6 text-muted-foreground" />
            </div>
            
            <h2 className="text-base font-semibold mb-1">Odkrywaj TRASA</h2>
            <p className="text-xs text-muted-foreground max-w-xs">
              Szukaj tras, użytkowników i miejsc
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {isLoading && (
              <p className="text-center text-muted-foreground py-8">Wyszukiwanie...</p>
            )}

            {/* Wyniki tras */}
            {searchResults?.routes && searchResults.routes.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3">Trasy ({searchResults.routes.length})</h3>
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
                <h3 className="font-semibold mb-3">Użytkownicy ({searchResults.users.length})</h3>
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
                <h3 className="font-semibold mb-3">Miejsca ({searchResults.places.length})</h3>
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
  );
};

export default Search;
