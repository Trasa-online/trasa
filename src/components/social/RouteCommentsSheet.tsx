import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowUp, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useNavigate } from "react-router-dom";

interface RouteCommentsSheetProps {
  routeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RouteCommentsSheet({ routeId, open, onOpenChange }: RouteCommentsSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 300);
  }, [open]);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["route-comments", routeId],
    queryFn: async () => {
      const { data } = await supabase
        .from("comments")
        .select("id, content, created_at, user_id, profiles(username, first_name, avatar_url)")
        .eq("route_id", routeId)
        .order("created_at", { ascending: true });
      return (data ?? []) as any[];
    },
    enabled: open,
  });

  const addMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error("Brak sesji");
      const { error } = await supabase.from("comments").insert({ route_id: routeId, user_id: user.id, content });
      if (error) throw error;
    },
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["route-comments", routeId] });
      queryClient.invalidateQueries({ queryKey: ["social-feed-v2", user?.id] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["route-comments", routeId] });
      queryClient.invalidateQueries({ queryKey: ["social-feed-v2", user?.id] });
    },
  });

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || addMutation.isPending) return;
    addMutation.mutate(trimmed);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] flex flex-col px-0 pb-0 rounded-t-3xl">
        <SheetHeader className="px-5 pb-3 border-b border-border/40">
          <SheetTitle className="text-base">Komentarze</SheetTitle>
        </SheetHeader>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <p className="text-center text-sm text-muted-foreground py-8">Ładowanie...</p>
          ) : comments.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-12">Brak komentarzy. Bądź pierwszy!</p>
          ) : (
            comments.map((c: any) => {
              const profile = c.profiles;
              const displayName = profile?.username || profile?.first_name || "Użytkownik";
              const isOwn = user?.id === c.user_id;
              return (
                <div key={c.id} className="flex gap-3 px-5 py-3">
                  <button onClick={() => profile?.username && navigate(`/profil/${profile.username}`)}>
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarImage src={profile?.avatar_url || ""} />
                      <AvatarFallback className="bg-orange-100 text-orange-600 text-xs font-bold">
                        {displayName.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold">{displayName}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: false, locale: pl })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground/90 mt-0.5 leading-snug">{c.content}</p>
                  </div>
                  {isOwn && (
                    <button
                      onClick={() => deleteMutation.mutate(c.id)}
                      className="text-muted-foreground/40 hover:text-destructive transition-colors flex-shrink-0 mt-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Input */}
        {user && (
          <div className="border-t border-border/40 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] flex items-center gap-3 bg-background">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className="bg-orange-100 text-orange-600 text-xs font-bold">
                {(user.email?.[0] ?? "U").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <input
              ref={inputRef}
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleSubmit()}
              placeholder="Dodaj komentarz..."
              className="flex-1 bg-muted rounded-full px-4 py-2 text-sm outline-none placeholder:text-muted-foreground"
            />
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || addMutation.isPending}
              className="h-8 w-8 rounded-full bg-orange-600 text-white flex items-center justify-center disabled:opacity-40 transition-opacity flex-shrink-0"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
