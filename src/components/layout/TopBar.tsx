import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const TopBar = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile-topbar", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("username, avatar_url")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  if (!user) return null;

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border/40 px-4 pt-safe pb-3 flex items-center justify-between">
      {user ? (
        <button onClick={() => navigate("/moj-profil")} className="p-0.5">
          <Avatar className="h-11 w-11">
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback className="bg-orange-100 dark:bg-orange-900/40 text-orange-600 text-sm font-bold">
              {profile?.username?.charAt(0)?.toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
        </button>
      ) : (
        <div className="w-11" />
      )}
      <button
        onClick={() => navigate("/")}
        className="text-xl font-black tracking-tight"
      >
        TRASA
      </button>
      <button
        onClick={() => navigate("/create")}
        aria-label="Zaplanuj podróż"
        className="h-11 w-11 rounded-full orb-gradient active:scale-90 transition-transform"
      />
    </header>
  );
};

export default TopBar;
