import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Camera, Shield, ChevronRight, Compass, Bell } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const Settings = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { t, i18n } = useTranslation("settings");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user?.id)
        .eq("role", "admin")
        .maybeSingle();

      return !!data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || "");
      setAvatarUrl(profile.avatar_url || "");
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ username, avatar_url: avatarUrl })
        .eq("id", user?.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast({ title: t("toast_saved") });
    },
  });

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;

    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/avatar.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, { upsert: true });

    if (uploadError) {
      toast({ variant: "destructive", title: t("toast_avatar_error") });
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("avatars")
      .getPublicUrl(fileName);

    setAvatarUrl(publicUrl);
  };

  if (loading || !user) return null;

  return (
    <>
      <PageHeader title={t("title")} showBack />
      <div className="p-4 space-y-6">
        <div className="flex flex-col items-center gap-4 bg-card rounded-xl p-4">
          <div className="relative">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback>{username?.[0]?.toUpperCase()}</AvatarFallback>
            </Avatar>
            <label className="absolute bottom-0 right-0 bg-foreground text-background p-2 rounded-full cursor-pointer">
              <Camera className="h-4 w-4" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                }}
              />
            </label>
          </div>
        </div>

        <div className="space-y-4 bg-card rounded-xl p-4">
          <div>
            <Label htmlFor="username">{t("username")}</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-background"
            />
          </div>

          <Button
            className="w-full"
            onClick={() => updateProfileMutation.mutate()}
            disabled={updateProfileMutation.isPending}
          >
            {t("save_changes")}
          </Button>
        </div>

        <button
          onClick={() => navigate("/moj-profil")}
          className="w-full flex items-center gap-3 px-4 py-3 bg-card rounded-xl border border-border/40 hover:bg-muted transition-colors text-left"
        >
          <Compass className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-sm font-medium flex-1">{t("travel_profile")}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>

        <button
          onClick={() => i18n.changeLanguage(i18n.language === "pl" ? "en" : "pl")}
          className="w-full flex items-center gap-3 px-4 py-3 bg-card rounded-xl border border-border/40 hover:bg-muted transition-colors text-left"
        >
          <span className="text-sm font-medium flex-1">{t("language")}</span>
          <span className="text-sm text-muted-foreground font-medium">{i18n.language === "pl" ? "🇵🇱 PL" : "🇬🇧 EN"}</span>
        </button>

        <div className="space-y-2 bg-card rounded-xl p-4">
          {isAdmin && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate("/admin")}
            >
              <Shield className="h-4 w-4 mr-2" />
              {t("admin_panel")}
            </Button>
          )}
          <Button variant="outline" className="w-full">
            {t("change_password")}
          </Button>
          <Button variant="destructive" className="w-full" onClick={signOut}>
            {t("logout")}
          </Button>
        </div>
      </div>
    </>
  );
};

export default Settings;
