import { useState } from "react";
import { useTranslation } from "react-i18next";
import { avatarSrc } from "@/lib/avatar";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import FollowButton from "@/components/social/FollowButton";
import InviteFriendsBanner from "@/components/social/InviteFriendsBanner";

type Profile = { id: string; username: string; first_name: string | null; avatar_url: string | null };

export default function UserSearch() {
  const { t } = useTranslation("profiles");
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  // Load all profiles up front - filter client-side (no API call on type = no Face ID)
  const { data: allProfiles = [], isLoading } = useQuery({
    queryKey: ["all-profiles", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, first_name, avatar_url")
        .neq("id", user?.id ?? "")
        .not("username", "is", null)
        .order("username")
        .limit(200);
      return (data ?? []) as Profile[];
    },
    enabled: !!user,
  });

  // Konta biznesowe (wlasciciele business_profiles) NIE pokazuja sie w wyszukiwarce userow.
  const { data: businessOwnerIds = [] } = useQuery({
    queryKey: ["business-owner-ids"],
    queryFn: async () => {
      const { data } = await supabase.from("business_profiles").select("owner_user_id");
      return (data ?? []).map((b: any) => b.owner_user_id).filter(Boolean) as string[];
    },
  });

  // Client-side filter - no network call. Wyklucz konta biznesowe + konta-gosci (anon).
  // Goscie (ensure_current_user_profile) dostaja username user_xxxxxxxx (8 hex) - nie
  // pokazujemy ich w wyszukiwarce, zeby nie zasmiecali wynikow.
  const bizSet = new Set(businessOwnerIds);
  const isGuestUsername = (u: string | null) => !!u && /^user_[0-9a-f]{8}$/.test(u);
  const base = allProfiles.filter(p => !bizSet.has(p.id) && !isGuestUsername(p.username));
  const trimmed = query.trim().replace(/^@/, "").toLowerCase();
  const visible = trimmed
    ? base.filter(p =>
        p.username?.toLowerCase().includes(trimmed) ||
        p.first_name?.toLowerCase().includes(trimmed)
      )
    : base;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe-4 pb-3 border-b border-border/40 sticky top-0 bg-background z-10">
        <button
          onClick={() => navigate(-1)}
          className="h-9 w-9 flex items-center justify-center rounded-2xl text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 flex items-center gap-2 bg-muted rounded-2xl px-3 h-10">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-8">
        {!trimmed && (
          <div className="px-4 pt-4">
            <InviteFriendsBanner />
            <p className="text-sm font-bold mt-5 mb-1 px-1">{t("search.suggested")}</p>
          </div>
        )}
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-12">{t("search.loading")}</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">{t("search.no_results")}</p>
        ) : (
          <div className="divide-y divide-border/30">
            {visible.map(profile => {
              const displayName = profile.username || profile.first_name;
              return (
                <div key={profile.id} className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => navigate(`/profil/${profile.username}`)}>
                    <Avatar className="h-11 w-11">
                      <AvatarImage src={avatarSrc(profile.avatar_url)} className="object-cover bg-orange-100" />
                      <AvatarFallback className="bg-orange-100 text-orange-600 font-bold text-sm">
                        {displayName?.charAt(0).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/profil/${profile.username}`)}
                  >
                    <p className="text-sm font-semibold leading-tight">{displayName}</p>
                    <p className="text-xs text-muted-foreground">@{profile.username}</p>
                  </div>
                  <FollowButton targetUserId={profile.id} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
