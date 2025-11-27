import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, MapPin, Image as ImageIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const Admin = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin
  useQuery({
    queryKey: ["admin-check", user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();

      const isAdminUser = !!data;
      setIsAdmin(isAdminUser);
      
      if (!isAdminUser) {
        navigate("/");
      }
      
      return isAdminUser;
    },
    enabled: !!user && !loading,
  });

  // Fetch user statistics
  const { data: userStats } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          username,
          avatar_url,
          created_at,
          routes:routes(count),
          likes:likes(count),
          comments:comments(count)
        `);

      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // Fetch all routes with details
  const { data: allRoutes } = useQuery({
    queryKey: ["admin-routes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(`
          id,
          title,
          description,
          status,
          created_at,
          user_id,
          profiles:profiles(username, avatar_url),
          pins:pins(id, image_url, place_name),
          likes:likes(count),
          comments:comments(count)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  if (loading || !isAdmin) {
    return null;
  }

  const totalUsers = userStats?.length || 0;
  const totalRoutes = allRoutes?.length || 0;
  const totalPins = allRoutes?.reduce((acc, route) => acc + (route.pins?.length || 0), 0) || 0;
  const totalImages = allRoutes?.reduce((acc, route) => 
    acc + (route.pins?.filter(pin => pin.image_url)?.length || 0), 0) || 0;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Panel Administracyjny</h1>
          <p className="text-muted-foreground">Przegląd wszystkich danych z aplikacji</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Użytkownicy</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
              <p className="text-xs text-muted-foreground">Zarejestrowanych kont</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trasy</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRoutes}</div>
              <p className="text-xs text-muted-foreground">Utworzonych tras</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Miejsca</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPins}</div>
              <p className="text-xs text-muted-foreground">Dodanych miejsc</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Zdjęcia</CardTitle>
              <ImageIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalImages}</div>
              <p className="text-xs text-muted-foreground">Przesłanych zdjęć</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList>
            <TabsTrigger value="users">Użytkownicy</TabsTrigger>
            <TabsTrigger value="routes">Trasy</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Lista użytkowników</CardTitle>
                <CardDescription>Wszyscy zarejestrowani użytkownicy</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {userStats?.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={user.avatar_url || ""} />
                          <AvatarFallback>{user.username?.[0]?.toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold">{user.username}</p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(user.created_at).toLocaleDateString("pl-PL")}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="secondary">{user.routes?.[0]?.count || 0} tras</Badge>
                        <Badge variant="outline">{user.likes?.[0]?.count || 0} polubień</Badge>
                        <Badge variant="outline">{user.comments?.[0]?.count || 0} komentarzy</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="routes" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Wszystkie trasy</CardTitle>
                <CardDescription>Kompletna lista tras wraz ze zdjęciami</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {allRoutes?.map((route) => (
                    <div
                      key={route.id}
                      className="p-4 border rounded-lg hover:bg-muted/50 transition-colors space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold text-lg">{route.title}</h3>
                            <Badge variant={route.status === "published" ? "default" : "secondary"}>
                              {route.status === "published" ? "Opublikowana" : "Szkic"}
                            </Badge>
                          </div>
                          {route.description && (
                            <p className="text-sm text-muted-foreground mb-2">{route.description}</p>
                          )}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Avatar className="h-6 w-6">
                                <AvatarImage src={route.profiles?.avatar_url || ""} />
                                <AvatarFallback>{route.profiles?.username?.[0]?.toUpperCase()}</AvatarFallback>
                              </Avatar>
                              <span>{route.profiles?.username}</span>
                            </div>
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(route.created_at).toLocaleDateString("pl-PL")}
                            </span>
                            <Badge variant="outline">{route.pins?.length || 0} miejsc</Badge>
                            <Badge variant="outline">{route.likes?.[0]?.count || 0} polubień</Badge>
                          </div>
                        </div>
                      </div>
                      
                      {route.pins && route.pins.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">Miejsca:</h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {route.pins.map((pin) => (
                              <div key={pin.id} className="space-y-1">
                                {pin.image_url ? (
                                  <div className="relative aspect-square rounded-md overflow-hidden bg-muted">
                                    <img
                                      src={pin.image_url}
                                      alt={pin.place_name}
                                      className="object-cover w-full h-full"
                                    />
                                  </div>
                                ) : (
                                  <div className="aspect-square rounded-md bg-muted flex items-center justify-center">
                                    <ImageIcon className="h-8 w-8 text-muted-foreground" />
                                  </div>
                                )}
                                <p className="text-xs font-medium truncate">{pin.place_name}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Admin;
