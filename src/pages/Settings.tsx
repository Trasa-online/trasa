import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getConsent, grantConsent, denyConsent } from "@/lib/consent";

import { PageHeader } from "@/components/layout/PageHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Shield, Bell, LogOut, ChevronRight, Cookie, FileText, Trash2, KeyRound } from "lucide-react";
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

function DeleteAccountButton({ onDeleted }: { onDeleted: () => void }) {
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_current_user_account" as any);
      if (error) throw error;
      onDeleted();
    } catch {
      toast.error("Nie udało się usunąć konta. Spróbuj ponownie.");
      setDeleting(false);
      setConfirm(false);
    }
  };

  if (!confirm) {
    return (
      <button
        onClick={() => setConfirm(true)}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-card rounded-2xl border border-border/40 hover:bg-muted transition-colors text-left"
      >
        <Trash2 className="h-4 w-4 text-destructive flex-shrink-0" />
        <span className="text-sm font-medium text-destructive flex-1">Usuń konto</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 space-y-3">
      <p className="text-sm font-semibold text-destructive">Usunąć konto na stałe?</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Wszystkie Twoje trasy, piny, preferencje i dane zostaną trwale usunięte. Tej operacji nie można cofnąć.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setConfirm(false)}
          disabled={deleting}
          className="flex-1 py-2.5 rounded-xl border border-border/60 text-sm font-medium"
        >
          Anuluj
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex-1 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-50"
        >
          {deleting ? "Usuwam…" : "Usuń na stałe"}
        </button>
      </div>
    </div>
  );
}

function ChangePasswordSection() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 6) { toast.error("Hasło musi mieć co najmniej 6 znaków"); return; }
    if (newPass !== confirm) { toast.error("Hasła nie są identyczne"); return; }
    setLoading(true);
    try {
      // Verify current password by re-authenticating
      const { data: { user } } = await supabase.auth.getUser();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: current,
      });
      if (signInErr) throw new Error("Nieprawidłowe aktualne hasło");

      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
      toast.success("Hasło zostało zmienione");
      setOpen(false);
      setCurrent(""); setNewPass(""); setConfirm("");
    } catch (err: any) {
      toast.error(err.message || "Błąd zmiany hasła");
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-card rounded-2xl border border-border/40 hover:bg-muted transition-colors text-left"
      >
        <KeyRound className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium flex-1">Zmień hasło</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="bg-card border border-border/40 rounded-2xl p-4 space-y-3">
      <p className="text-sm font-semibold">Zmień hasło</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="password"
          placeholder="Aktualne hasło"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          className="bg-background"
        />
        <Input
          type="password"
          placeholder="Nowe hasło (min. 6 znaków)"
          value={newPass}
          onChange={(e) => setNewPass(e.target.value)}
          required
          className="bg-background"
        />
        <Input
          type="password"
          placeholder="Powtórz nowe hasło"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className="bg-background"
        />
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => { setOpen(false); setCurrent(""); setNewPass(""); setConfirm(""); }}
            className="flex-1 py-2.5 rounded-xl border border-border/60 text-sm font-medium"
          >
            Anuluj
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold disabled:opacity-50"
          >
            {loading ? "Zapisuję..." : "Zapisz"}
          </button>
        </div>
      </form>
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
    <div className="min-h-screen bg-background pb-[calc(3rem+env(safe-area-inset-bottom,0px))]">
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

        {/* Password */}
        <div className="space-y-2">
          <ChangePasswordSection />
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

          <DeleteAccountButton onDeleted={() => { signOut(); navigate("/"); }} />
        </div>

      </div>
    </div>
  );
};

export default Settings;
