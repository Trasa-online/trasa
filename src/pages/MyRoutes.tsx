import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/layout/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Plus, FileText, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import EmptyState from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import RouteItem from "@/components/route/RouteItem";
import FolderCard from "@/components/route/FolderCard";
import { useFolders } from "@/hooks/useFolders";

const MyRoutes = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [deletingRouteId, setDeletingRouteId] = useState<string | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);

  const { folders, deleteFolder } = useFolders();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-notifications", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
  });

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
        .select(`*, pins (*), likes (user_id), comments (id)`)
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
        .select(`*, pins (*), likes (user_id), comments (id)`)
        .eq("user_id", user?.id)
        .eq("status", "draft")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (routeId: string) => {
      const { error: pinsError } = await supabase
        .from("pins")
        .delete()
        .eq("route_id", routeId);
      if (pinsError) throw pinsError;

      const { error } = await supabase.from("routes").delete().eq("id", routeId);
      if (error) throw error;
    },
    onMutate: async (routeId) => {
      await queryClient.cancelQueries({ queryKey: ["my-routes-published"] });
      await queryClient.cancelQueries({ queryKey: ["my-routes-draft"] });

      const prevPublished = queryClient.getQueryData<any[]>(["my-routes-published", user?.id]);
      const prevDraft = queryClient.getQueryData<any[]>(["my-routes-draft", user?.id]);

      queryClient.setQueryData<any[]>(["my-routes-published", user?.id], (old) =>
        old?.filter((r) => r.id !== routeId) ?? []
      );
      queryClient.setQueryData<any[]>(["my-routes-draft", user?.id], (old) =>
        old?.filter((r) => r.id !== routeId) ?? []
      );

      return { prevPublished, prevDraft };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-routes-published"] });
      queryClient.invalidateQueries({ queryKey: ["my-routes-draft"] });
      toast({ title: "Trasa została usunięta" });
    },
    onError: (_err, _routeId, context) => {
      if (context?.prevPublished) {
        queryClient.setQueryData(["my-routes-published", user?.id], context.prevPublished);
      }
      if (context?.prevDraft) {
        queryClient.setQueryData(["my-routes-draft", user?.id], context.prevDraft);
      }
      toast({ variant: "destructive", title: "Błąd", description: "Nie udało się usunąć trasy" });
    },
  });

  if (loading || !user) return null;

  return (
    <>
      <PageHeader title="TRASA" showBell showSearch unreadCount={unreadCount} />

      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold">Twoje trasy</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {(publishedRoutes?.length || 0) + (draftRoutes?.length || 0)} tras · {folders.length} podróży
            </p>
          </div>
          <Button size="sm" onClick={() => navigate("/create")}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nowa
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground px-4 pb-2">
        Podróże grupują trasy z jednego wyjazdu (np. "Japonia" z dniami 1-14)
      </p>

      <Tabs defaultValue="published" className="w-full">
        <div className="px-4">
          <TabsList className="w-full grid grid-cols-3 bg-muted/50">
            <TabsTrigger value="published" className="text-xs">
              Opublikowane ({publishedRoutes?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="draft" className="text-xs">
              Robocze ({draftRoutes?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="folders" className="text-xs">
              Podróże ({folders.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="published" className="space-y-3 px-4 mt-3">
          {publishedRoutes?.map((route) => (
            <RouteItem key={route.id} route={route} onDelete={setDeletingRouteId} />
          ))}
          {publishedRoutes?.length === 0 && (
            <EmptyState
              icon={MapPin}
              title="Brak opublikowanych tras"
              description="Stwórz swoją pierwszą trasę i podziel się nią ze znajomymi!"
              actionLabel="Stwórz pierwszą trasę"
              actionIcon={Plus}
              onAction={() => navigate("/create")}
            />
          )}
        </TabsContent>

        <TabsContent value="draft" className="space-y-3 px-4 mt-3">
          {draftRoutes?.map((route) => (
            <RouteItem key={route.id} route={route} onDelete={setDeletingRouteId} />
          ))}
          {draftRoutes?.length === 0 && (
            <EmptyState
              icon={FileText}
              title="Brak roboczych tras"
              description="Rozpocznij tworzenie trasy, a zostanie automatycznie zapisana jako robocza"
              actionLabel="Zacznij nową trasę"
              actionIcon={Plus}
              onAction={() => navigate("/create")}
            />
          )}
        </TabsContent>

        <TabsContent value="folders" className="space-y-3 px-4 mt-3">
          {folders.map((folder) => (
            <FolderCard
              key={folder.id}
              folder={folder}
              onDelete={setDeletingFolderId}
              onEdit={(id) => navigate(`/edit-folder/${id}`)}
            />
          ))}
          {folders.length === 0 && (
            <EmptyState
              icon={FolderPlus}
              title="Brak podróży"
              description="Grupuj swoje trasy w podróże – osobna podróż na każdy wyjazd"
              actionLabel="Utwórz podróż"
              actionIcon={Plus}
              onAction={() => navigate("/create-folder")}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Delete route dialog */}
      <AlertDialog open={!!deletingRouteId} onOpenChange={(open) => !open && setDeletingRouteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń trasę</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć tę trasę? Tej akcji nie można cofnąć.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingRouteId) {
                  deleteMutation.mutate(deletingRouteId);
                  setDeletingRouteId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete folder dialog */}
      <AlertDialog open={!!deletingFolderId} onOpenChange={(open) => !open && setDeletingFolderId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Usuń podróż</AlertDialogTitle>
            <AlertDialogDescription>
              Czy na pewno chcesz usunąć tę podróż? Trasy w niej zawarte nie zostaną usunięte, tylko odłączone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anuluj</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingFolderId) {
                  deleteFolder.mutate(deletingFolderId);
                  setDeletingFolderId(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Usuń
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default MyRoutes;
