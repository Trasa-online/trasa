import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getConsent, grantConsent, denyConsent } from "@/lib/consent";

import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Shield, Bell, LogOut, ChevronRight, Cookie, FileText } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

function PushToggleSection() {
  const { isSupported, isSubscribed, isLoading, toggle } = usePushNotifications();
  const { t } = useTranslation("settings");
  if (!isSupported) return null;
  return (
    <div className="w-full flex items-center gap-3 px-4 py-3.5 bg-card rounded-2xl border border-border/40">
      <Bell className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="text-sm font-medium flex-1">{t("push_notifications")}</span>
      <Switch checked={isSubscribed} onCheckedChange={toggle} disabled={isLoading} />
    </div>
  );
}

function CookieConsentSection() {
  const [consent, setConsent] = useState(getConsent());
  const { t } = useTranslation("settings");

  const handleToggle = (checked: boolean) => {
    if (checked) {
      grantConsent();
      setConsent("granted");
      toast.success(t("cookies_granted"));
    } else {
      denyConsent();
      setConsent("denied");
      toast.success(t("cookies_denied"));
    }
  };

  return (
    <div className="w-full flex items-center gap-3 px-4 py-3.5 bg-card rounded-2xl border border-border/40">
      <Cookie className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1">
        <span className="text-sm font-medium">{t("cookies_analytics")}</span>
        <p className="text-xs text-muted-foreground">{t("cookies_desc")}</p>
      </div>
      <Switch checked={consent === "granted"} onCheckedChange={handleToggle} />
    </div>
  );
}

const Settings = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation("settings");

  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
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
      setFirstName((profile as any).first_name || "");
      setUsername(profile.username || "");
      setAvatarUrl(profile.avatar_url || "");
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ first_name: firstName, username, avatar_url: avatarUrl } as any)
        .eq("id", user?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success(t("toast_saved"));
    },
  });

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/avatar.${fileExt}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, { upsert: true });
    if (uploadError) { toast.error(t("toast_avatar_error")); return; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(fileName);
    setAvatarUrl(publicUrl);
  };

  if (loading || !user) return null;

  const displayName = firstName || username || "";

  return (
    <div className="min-h-screen bg-background pb-10">
      <PageHeader title={t("title")} showBack />

      <div className="p-4 space-y-6 max-w-lg mx-auto">

        {/* Avatar */}
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="bg-orange-100 text-orange-600 text-2xl font-bold">
                {displayName.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <label className="absolute bottom-0 right-0 bg-foreground text-background p-1.5 rounded-full cursor-pointer shadow">
              <Camera className="h-3.5 w-3.5" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }}
              />
            </label>
          </div>
          {displayName && <p className="text-base font-bold">{displayName}</p>}
        </div>

        {/* Profile fields */}
        <div className="bg-card border border-border/40 rounded-2xl p-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="first_name">{t("first_name")}</Label>
            <Input
              id="first_name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="np. Marta"
              className="bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="username">{t("username")}</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="twoja_nazwa"
              className="bg-background"
            />
          </div>
          <button
            onClick={() => updateProfileMutation.mutate()}
            disabled={updateProfileMutation.isPending}
            className="w-full py-3 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {updateProfileMutation.isPending ? "Zapisuję..." : t("save_changes")}
          </button>
        </div>

        {/* Other settings */}
        <div className="space-y-2">
          <PushToggleSection />

          <CookieConsentSection />

          <Link
            to="/terms"
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-card rounded-2xl border border-border/40 hover:bg-muted transition-colors text-left"
          >
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm font-medium flex-1">{t("terms")}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>

          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-card rounded-2xl border border-border/40 hover:bg-muted transition-colors text-left"
            >
              <Shield className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium flex-1">{t("admin_panel")}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Danger zone */}
        <div className="space-y-2">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-4 py-3.5 bg-card rounded-2xl border border-border/40 hover:bg-muted transition-colors text-left"
          >
            <LogOut className="h-4 w-4 text-destructive flex-shrink-0" />
            <span className="text-sm font-medium text-destructive flex-1">{t("logout")}</span>
          </button>
        </div>

      </div>
    </div>
  );
};

export default Settings;
