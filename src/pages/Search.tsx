import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MapPin, User, Search as SearchIcon } from "lucide-react";
import RouteCard from "@/components/route/RouteCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const Search = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [routes, setRoutes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [places, setPlaces] = useState<any[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (query.length > 0) {
      searchAll();
    } else {
      setRoutes([]);
      setUsers([]);
      setPlaces([]);
    }
  }, [query]);

  const searchAll = async () => {
    const { data: routesData } = await supabase
      .from("routes")
      .select("*, profiles:user_id (username, avatar_url), pins (*)")
      .eq("status", "published")
      .ilike("title", `%${query}%`);

    const { data: usersData } = await supabase
      .from("profiles")
      .select("*")
      .ilike("username", `%${query}%`);

    const { data: pinsData } = await supabase
      .from("pins")
      .select("*, routes!inner (*, profiles:user_id (username, avatar_url))")
      .eq("routes.status", "published")
      .ilike("place_name", `%${query}%`);

    setRoutes(routesData || []);
    setUsers(usersData || []);
    setPlaces(pinsData || []);
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 bg-background border-b border-border p-4 space-y-4 z-10">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-xl font-semibold">Szukaj</h1>
        </div>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj tras, użytkowników, miejsc..."
            className="pl-10"
          />
        </div>
      </div>

      <div className="max-w-lg mx-auto">
        {query.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
              <SearchIcon className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Szukaj czegokolwiek</h2>
            <p className="text-muted-foreground max-w-xs">
              Odkrywaj trasy, użytkowników i miejsca w aplikacji TRASA
            </p>
            <div className="mt-8 space-y-4 w-full">
              <div className="flex items-start gap-3 text-left">
                <MapPin className="h-5 w-5 mt-1" />
                <div>
                  <p className="font-medium">Trasy</p>
                  <p className="text-sm text-muted-foreground">
                    Odkrywaj trasy stworzone przez innych użytkowników
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-left">
                <User className="h-5 w-5 mt-1" />
                <div>
                  <p className="font-medium">Użytkownicy</p>
                  <p className="text-sm text-muted-foreground">
                    Znajdź i obserwuj innych podróżników
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-left">
                <MapPin className="h-5 w-5 mt-1" />
                <div>
                  <p className="font-medium">Miejsca</p>
                  <p className="text-sm text-muted-foreground">
                    Eksploruj konkretne miejsca i atrakcje
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="all" className="w-full p-4">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="all">Wszystko</TabsTrigger>
              <TabsTrigger value="routes">Trasy</TabsTrigger>
              <TabsTrigger value="users">Użytkownicy</TabsTrigger>
              <TabsTrigger value="places">Miejsca</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-6 mt-4">
              {routes.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Trasy</h3>
                  <div className="space-y-4">
                    {routes.slice(0, 3).map((route) => (
                      <RouteCard key={route.id} route={route} />
                    ))}
                  </div>
                </div>
              )}
              {users.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Użytkownicy</h3>
                  <div className="space-y-2">
                    {users.slice(0, 3).map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg"
                      >
                        <Avatar>
                          <AvatarImage src={user.avatar_url} />
                          <AvatarFallback>
                            {user.username?.[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{user.username}</p>
                          {user.bio && (
                            <p className="text-sm text-muted-foreground">
                              {user.bio}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="routes" className="space-y-4 mt-4">
              {routes.map((route) => (
                <RouteCard key={route.id} route={route} />
              ))}
              {routes.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Nie znaleziono tras
                </p>
              )}
            </TabsContent>

            <TabsContent value="users" className="space-y-2 mt-4">
              {users.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-3 hover:bg-accent rounded-lg"
                >
                  <Avatar>
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback>
                      {user.username?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{user.username}</p>
                    {user.bio && (
                      <p className="text-sm text-muted-foreground">{user.bio}</p>
                    )}
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Nie znaleziono użytkowników
                </p>
              )}
            </TabsContent>

            <TabsContent value="places" className="space-y-4 mt-4">
              {places.map((pin: any) => (
                <div
                  key={pin.id}
                  onClick={() => navigate(`/route/${pin.routes.id}`)}
                  className="bg-card border border-border rounded-lg p-4 cursor-pointer"
                >
                  <div className="flex gap-3">
                    {pin.image_url && (
                      <img
                        src={pin.image_url}
                        alt={pin.place_name}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-semibold">{pin.place_name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {pin.address}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        W trasie: {pin.routes.title}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {places.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Nie znaleziono miejsc
                </p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
};

export default Search;
