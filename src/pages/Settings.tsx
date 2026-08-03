import { useState, useEffect, useRef } from "react";
import { avatarSrc } from "@/lib/avatar";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getConsent, grantConsent, denyConsent } from "@/lib/consent";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Shield, Bell, LogOut, ChevronRight, Cookie, FileText, Trash2, KeyRound, AlertCircle, X, ArrowLeft, Link as LinkIcon, Mail, Languages, RotateCcw } from "lucide-react";
import { isHardcodedAdmin } from "@/lib/admins";
import { useOnboarding } from "@/components/OnboardingGuide";
import { Switch } from "@/components/ui/switch";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { isNative } from "@/lib/platform";
import { Camera as CapCamera, CameraResultType, CameraSource } from "@capacitor/camera";

type Provider = "email" | "google" | "apple";

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  apple: "Apple",
};

function ProviderIcon({ provider }: { provider: Provider }) {
  if (provider === "google") return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
  if (provider === "apple") return (
    <svg className="h-4 w-4 shrink-0 text-foreground" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
  return <Mail className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function LinkedAccountsSection() {
  const queryClient = useQueryClient();
  const { t } = useTranslation("settings");
  const [linking, setLinking] = useState<Provider | null>(null);

  const providerLabel = (p: string) => (p === "email" ? t("provider_email") : PROVIDER_LABEL[p as Provider] ?? p);

  const { data: identities = [], isLoading } = useQuery({
    queryKey: ["user-identities"],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) throw error;
      return (data?.identities ?? []) as Array<{ id: string; provider: string; identity_data?: { email?: string } }>;
    },
  });

  const handleLink = async (provider: "google" | "apple") => {
    setLinking(provider);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider,
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      // Supabase przekierowuje do providera — kod poniżej nie wykona się przy sukcesie.
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message.toLowerCase() : "";
      if (msg.includes("manual linking") || msg.includes("not enabled")) {
        toast.error(t("link_disabled"));
      } else if (msg.includes("already")) {
        toast.error(t("link_already"));
      } else {
        toast.error(err instanceof Error ? err.message : t("link_error"));
      }
      setLinking(null);
    }
  };

  const handleUnlink = async (identity: { id: string; provider: string }) => {
    if (identities.length <= 1) {
      toast.error(t("unlink_only_method"));
      return;
    }
    if (!confirm(t("unlink_confirm", { provider: providerLabel(identity.provider) }))) return;
    try {
      const { error } = await supabase.auth.unlinkIdentity(identity as never);
      if (error) throw error;
      toast.success(t("unlinked"));
      queryClient.invalidateQueries({ queryKey: ["user-identities"] });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("unlink_error"));
    }
  };

  if (isLoading) return null;

  const has = (p: Provider) => identities.some((i) => i.provider === p);

  return (
    <div className="space-y-2">
      <h3 className="text-xs uppercase tracking-wide text-muted-foreground px-1 mb-1">{t("linked_accounts")}</h3>

      {identities.map((identity) => {
        const provider = identity.provider as Provider;
        const canUnlink = identities.length > 1;
        return (
          <div key={identity.id} className="w-full flex items-center gap-3 px-4 py-3.5 bg-card rounded-2xl border border-border/40">
            <ProviderIcon provider={provider} />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium block">{providerLabel(provider)}</span>
              {identity.identity_data?.email && (
                <span className="text-xs text-muted-foreground truncate block">{identity.identity_data.email}</span>
              )}
            </div>
            {canUnlink && provider !== "email" && (
              <button
                onClick={() => handleUnlink(identity)}
                className="text-xs text-muted-foreground hover:text-destructive px-2 py-1"
              >
                {t("unlink")}
              </button>
            )}
          </div>
        );
      })}

      {!has("google") && (
        <button
          onClick={() => handleLink("google")}
          disabled={linking !== null}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-card rounded-2xl border border-border/40 hover:bg-muted transition-colors text-left disabled:opacity-60"
        >
          <ProviderIcon provider="google" />
          <span className="text-sm font-medium flex-1">{linking === "google" ? t("linking") : t("link_google")}</span>
          <LinkIcon className="h-4 w-4 text-muted-foreground" />
        </button>
      )}

      {!has("apple") && (
        <button
          onClick={() => handleLink("apple")}
          disabled={linking !== null}
          className="w-full flex items-center gap-3 px-4 py-3.5 bg-card rounded-2xl border border-border/40 hover:bg-muted transition-colors text-left disabled:opacity-60"
        >
          <ProviderIcon provider="apple" />
          <span className="text-sm font-medium flex-1">{linking === "apple" ? t("linking") : t("link_apple")}</span>
          <LinkIcon className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}

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
  const { t } = useTranslation("settings");
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase.rpc("delete_current_user_account" as any);
      if (error) throw error;
      onDeleted();
    } catch {
      toast.error(t("delete_error"));
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
        <span className="text-sm font-medium text-destructive flex-1">{t("delete_account")}</span>
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 space-y-3">
      <p className="text-sm font-semibold text-destructive">{t("delete_confirm_title")}</p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        {t("delete_confirm_desc")}
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => setConfirm(false)}
          disabled={deleting}
          className="flex-1 py-2.5 rounded-2xl border border-border/60 text-sm font-medium"
        >
          {t("cancel")}
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex-1 py-2.5 rounded-2xl bg-destructive text-destructive-foreground text-sm font-semibold disabled:opacity-50"
        >
          {deleting ? t("deleting") : t("delete_permanent")}
        </button>
      </div>
    </div>
  );
}

function ChangePasswordSection() {
  const { t } = useTranslation("settings");
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPass.length < 6) { toast.error(t("password_too_short")); return; }
    if (newPass !== confirm) { toast.error(t("password_mismatch")); return; }
    setLoading(true);
    try {
      // Verify current password by re-authenticating
      const { data: { user } } = await supabase.auth.getUser();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: user!.email!,
        password: current,
      });
      if (signInErr) throw new Error(t("password_wrong_current"));

      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw error;
      toast.success(t("password_changed"));
      setOpen(false);
      setCurrent(""); setNewPass(""); setConfirm("");
    } catch (err: any) {
      toast.error(err.message || t("password_change_error"));
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
        <span className="text-sm font-medium flex-1">{t("change_password")}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <div className="bg-card border border-border/40 rounded-2xl p-4 space-y-3">
      <p className="text-sm font-semibold">{t("change_password")}</p>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Input
          type="password"
          placeholder={t("password_current_placeholder")}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          className="bg-background"
        />
        <Input
          type="password"
          placeholder={t("password_new_placeholder")}
          value={newPass}
          onChange={(e) => setNewPass(e.target.value)}
          required
          className="bg-background"
        />
        <Input
          type="password"
          placeholder={t("password_repeat_placeholder")}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          className="bg-background"
        />
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={() => { setOpen(false); setCurrent(""); setNewPass(""); setConfirm(""); }}
            className="flex-1 py-2.5 rounded-2xl border border-border/60 text-sm font-medium"
          >
            {t("cancel")}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 rounded-2xl bg-primary hover:bg-primary/90 text-white text-sm font-semibold disabled:opacity-50"
          >
            {loading ? t("saving") : t("save")}
          </button>
        </div>
      </form>
    </div>
  );
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

function BugReportSection({ userId }: { userId: string }) {
  const { t } = useTranslation("settings");
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState("");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleScreenshot = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `bug-reports/${userId}/${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from("route-images")
      .upload(path, file, { contentType: file.type, upsert: true });
    if (!error) {
      setScreenshotUrl(`${SUPABASE_URL}/storage/v1/object/public/route-images/${path}`);
    } else {
      toast.error(t("bug_upload_error"));
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!description.trim()) { toast.error(t("bug_empty")); return; }
    setSubmitting(true);
    const { error } = await (supabase as any).from("bug_reports").insert({
      user_id: userId,
      description: description.trim(),
      screenshot_url: screenshotUrl,
      source: "user",
    });
    if (error) { toast.error(t("bug_error", { message: error.message })); setSubmitting(false); return; }
    setDone(true);
    setSubmitting(false);
  };

  const reset = () => { setOpen(false); setDone(false); setDescription(""); setScreenshotUrl(null); };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center gap-3 px-4 py-3.5 bg-card rounded-2xl border border-border/40 hover:bg-muted transition-colors text-left"
      >
        <AlertCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium flex-1">{t("report_bug")}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  if (done) {
    return (
      <div className="bg-card border border-border/40 rounded-2xl p-5 flex flex-col items-center gap-2 text-center">
        <div className="text-3xl">🙏</div>
        <p className="text-sm font-bold">{t("bug_thanks_title")}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">{t("bug_thanks_desc")}</p>
        <button onClick={reset} className="mt-1 text-xs text-muted-foreground/60 underline underline-offset-2">{t("bug_close")}</button>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border/40 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{t("report_bug")}</p>
        <button onClick={reset} className="p-1 text-muted-foreground/60 hover:text-muted-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <textarea
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder={t("bug_placeholder")}
        rows={4}
        maxLength={2000}
        className="w-full bg-background rounded-2xl px-3 py-2.5 text-sm resize-none focus:outline-none border border-border/30 placeholder:text-muted-foreground/60 leading-relaxed"
      />
      {screenshotUrl ? (
        <div className="relative rounded-2xl overflow-hidden">
          <img src={screenshotUrl} alt="screenshot" className="w-full max-h-48 object-cover" />
          <button
            onClick={() => setScreenshotUrl(null)}
            className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm rounded-full p-1.5"
          >
            <X className="h-3.5 w-3.5 text-white" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full py-2.5 rounded-2xl border border-dashed border-border/50 text-xs text-muted-foreground flex items-center justify-center gap-2 hover:bg-muted/40 transition-colors"
        >
          <Camera className="h-4 w-4" />
          {uploading ? t("bug_uploading") : t("bug_add_screenshot")}
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleScreenshot} />
      <div className="flex gap-2 pt-1">
        <button
          onClick={reset}
          className="flex-1 py-2.5 rounded-2xl border border-border/60 text-sm font-medium"
        >
          {t("cancel")}
        </button>
        <button
          onClick={handleSubmit}
          disabled={submitting || !description.trim()}
          className="flex-1 py-2.5 rounded-full bg-primary text-white text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform"
        >
          {submitting ? t("bug_submitting") : t("bug_submit")}
        </button>
      </div>
    </div>
  );
}

// Przelacznik jezyka PL/EN. changeLanguage zapisuje wybor do localStorage
// (LanguageDetector caches: localStorage), wiec przezywa restart appki.
function LanguageSection() {
  const { t, i18n } = useTranslation("settings");
  const current = (i18n.language || "pl").toLowerCase().startsWith("en") ? "en" : "pl";
  return (
    <div className="w-full flex items-center gap-3 px-4 py-3.5 bg-card rounded-2xl border border-border/40">
      <Languages className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <span className="text-sm font-medium flex-1">{t("language")}</span>
      <div className="flex gap-1 bg-muted rounded-full p-0.5">
        {([["pl", "Polski"], ["en", "English"]] as const).map(([code, label]) => (
          <button
            key={code}
            onClick={() => { if (code !== current) i18n.changeLanguage(code); }}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${current === code ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

const Settings = () => {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation("settings");
  const { restart: restartOnboarding } = useOnboarding();

  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      // [H3] wlasny profil przez RPC (SECURITY DEFINER) - po REVOKE invite_code/
      // deleted_* z profiles bezposredni select("*") nie zwrocilby tych kolumn.
      const { data: rows, error } = await (supabase as any).rpc("get_my_profile");
      if (error) throw error;
      const data = Array.isArray(rows) ? rows[0] : rows;
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
    const allowed = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
    const ext = allowed[file.type as keyof typeof allowed];
    if (!ext) { toast.error(t("avatar_type_error")); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error(t("avatar_size_error")); return; }
    const fileName = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(fileName, file, { upsert: true, contentType: file.type });
    if (uploadError) { toast.error(t("toast_avatar_error")); return; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(fileName);
    setAvatarUrl(`${publicUrl}?v=${Date.now()}`);
  };

  const handleNativePhotoPick = async () => {
    try {
      const photo = await CapCamera.getPhoto({
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
        quality: 90,
        width: 800,
        height: 800,
      });
      if (!photo.base64String) {
        toast.error(t("toast_avatar_error"));
        return;
      }
      const format = photo.format || "jpeg";
      const mime = format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
      const binary = atob(photo.base64String);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], `avatar.${format}`, { type: mime });
      await handleAvatarUpload(file);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("denied")) return;
      console.error("[Settings] native photo pick failed:", msg);
      toast.error(t("toast_avatar_error"));
    }
  };

  if (!user) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="h-8 w-8 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
    </div>
  );

  const displayName = firstName || username || "";

  return (
    <div className="pb-[calc(3rem+env(safe-area-inset-bottom,0px))]">
      <div className="flex items-center gap-2 px-2 pt-2 pb-1">
        <button
          onClick={() => navigate(-1)}
          className="h-9 w-9 flex items-center justify-center rounded-full text-muted-foreground active:bg-muted transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">{t("title")}</h1>
      </div>

      <div className="p-4 space-y-3 max-w-lg mx-auto">

        {/* Avatar */}
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="relative">
            <Avatar className="h-20 w-20">
              <AvatarImage src={avatarSrc(avatarUrl)} className="object-cover bg-orange-100" />
              <AvatarFallback className="bg-orange-100 text-orange-600 text-2xl font-bold">
                {displayName.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            {isNative ? (
              <button
                type="button"
                onClick={handleNativePhotoPick}
                className="absolute bottom-0 right-0 bg-foreground text-background p-1.5 rounded-full cursor-pointer shadow"
                aria-label={t("avatar_change_aria")}
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            ) : (
              <label className="absolute bottom-0 right-0 bg-foreground text-background p-1.5 rounded-full cursor-pointer shadow">
                <Camera className="h-3.5 w-3.5" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }}
                />
              </label>
            )}
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
              placeholder={t("first_name_placeholder")}
              className="bg-background"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="username">{t("username")}</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("username_placeholder")}
              className="bg-background"
            />
          </div>
          <button
            onClick={() => updateProfileMutation.mutate()}
            disabled={updateProfileMutation.isPending}
            className="w-full py-3 rounded-2xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm transition-colors disabled:opacity-50"
          >
            {updateProfileMutation.isPending ? t("saving") : t("save_changes")}
          </button>
        </div>

        {/* Linked accounts */}
        <LinkedAccountsSection />

        {/* Other settings */}
        <div className="space-y-2">
          <LanguageSection />

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

        </div>

        {/* Bug report */}
        <div className="space-y-2">
          <BugReportSection userId={user.id} />
        </div>

        {/* Password */}
        <div className="space-y-2">
          <ChangePasswordSection />
        </div>

        {/* Admin: reset onboardingu (dla testerow - czysci flage NA TYM urzadzeniu). */}
        {isHardcodedAdmin(user.email) && (
          <div className="space-y-2">
            <button
              onClick={() => {
                toast.success("Onboarding zresetowany");
                restartOnboarding();
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 bg-card rounded-2xl border border-border/40 hover:bg-muted transition-colors text-left"
            >
              <RotateCcw className="h-4 w-4 text-orange-600 flex-shrink-0" />
              <span className="text-sm font-medium flex-1">Pokaż onboarding ponownie <span className="text-muted-foreground font-normal">(admin)</span></span>
            </button>
          </div>
        )}

        {/* Danger zone */}
        <div className="space-y-2">
          <button
            onClick={async () => { await signOut(); navigate("/auth"); }}
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

import { Component, ErrorInfo, ReactNode } from "react";

class SettingsErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Settings] render error:", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="p-6 text-sm text-red-600 bg-red-50 m-4 rounded-2xl border border-red-200">
          <p className="font-bold mb-2">Błąd renderowania Settings:</p>
          <pre className="whitespace-pre-wrap text-xs">{String(this.state.error)}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function SettingsPage() {
  return (
    <SettingsErrorBoundary>
      <Settings />
    </SettingsErrorBoundary>
  );
}
