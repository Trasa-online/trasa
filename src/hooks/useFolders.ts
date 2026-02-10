import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface RouteFolder {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  folder_order: number;
  created_at: string;
  updated_at: string;
  routes?: any[];
}

export const useFolders = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: folders = [], isLoading } = useQuery({
    queryKey: ["my-folders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("route_folders")
        .select(`
          *,
          routes (
            id,
            title,
            status,
            folder_order,
            rating,
            pins (id, rating, is_transport)
          )
        `)
        .eq("user_id", user!.id)
        .order("folder_order", { ascending: true });

      if (error) throw error;
      return (data || []) as RouteFolder[];
    },
    enabled: !!user,
  });

  const createFolder = useMutation({
    mutationFn: async (params: { name: string; description?: string; cover_image_url?: string }) => {
      const maxOrder = folders.length > 0 
        ? Math.max(...folders.map(f => f.folder_order)) + 1 
        : 0;

      const { data, error } = await supabase
        .from("route_folders")
        .insert({
          user_id: user!.id,
          name: params.name,
          description: params.description || null,
          cover_image_url: params.cover_image_url || null,
          folder_order: maxOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-folders"] });
      toast({ title: "Folder utworzony" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Błąd", description: "Nie udało się utworzyć folderu" });
    },
  });

  const updateFolder = useMutation({
    mutationFn: async (params: { id: string; name?: string; description?: string; cover_image_url?: string }) => {
      const updates: any = {};
      if (params.name !== undefined) updates.name = params.name;
      if (params.description !== undefined) updates.description = params.description;
      if (params.cover_image_url !== undefined) updates.cover_image_url = params.cover_image_url;

      const { error } = await supabase
        .from("route_folders")
        .update(updates)
        .eq("id", params.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-folders"] });
      toast({ title: "Folder zaktualizowany" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Błąd", description: "Nie udało się zaktualizować folderu" });
    },
  });

  const deleteFolder = useMutation({
    mutationFn: async (folderId: string) => {
      const { error } = await supabase
        .from("route_folders")
        .delete()
        .eq("id", folderId);

      if (error) throw error;
    },
    onMutate: async (folderId) => {
      await queryClient.cancelQueries({ queryKey: ["my-folders", user?.id] });
      const prevFolders = queryClient.getQueryData<RouteFolder[]>(["my-folders", user?.id]);
      queryClient.setQueryData<RouteFolder[]>(["my-folders", user?.id], (old) =>
        old?.filter((f) => f.id !== folderId) ?? []
      );
      return { prevFolders };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-folders"] });
      queryClient.invalidateQueries({ queryKey: ["my-routes-published"] });
      queryClient.invalidateQueries({ queryKey: ["my-routes-draft"] });
      toast({ title: "Folder usunięty" });
    },
    onError: (_err, _folderId, context) => {
      if (context?.prevFolders) {
        queryClient.setQueryData(["my-folders", user?.id], context.prevFolders);
      }
      toast({ variant: "destructive", title: "Błąd", description: "Nie udało się usunąć folderu" });
    },
  });

  return { folders, isLoading, createFolder, updateFolder, deleteFolder };
};
