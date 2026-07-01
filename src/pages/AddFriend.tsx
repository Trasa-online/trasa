import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { befriendViaInvite } from "@/hooks/useFriends";
import { avatarSrc } from "@/lib/avatar";
import { Loader2, UserCheck, ArrowRight } from "lucide-react";

// Link zaproszeniowy /dodaj/:code -> AUTO-przyjazn z wlascicielem invite_code.
// Niezalogowany/anon -> rejestracja (return na ten link). Po loginie auto-przyjazn.
export default function AddFriend() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { user, isAnonymous, loading: authLoading } = useAuth();
  const [state, setState] = useState<"working" | "ok" | "already" | "error" | "self">("working");
  const [inviter, setInviter] = useState<{ username: string | null; first_name: string | null; avatar_url: string | null } | null>(null);
  const ran = useRef(false);

  useEffect(() => {
    if (authLoading || ran.current) return;
    if (!user || isAnonymous) {
      navigate(`/auth?return=/dodaj/${code}`);
      return;
    }
    ran.current = true;
    (async () => {
      try {
        const { data, error } = await befriendViaInvite(code!);
        if (error) throw error;
        if (!data?.ok) {
          setState(data?.reason === "self" ? "self" : "error");
          return;
        }
        const { data: prof } = await (supabase as any)
          .from("profiles").select("username, first_name, avatar_url").eq("id", data.inviter).maybeSingle();
        setInviter(prof ?? null);
        setState(data.already ? "already" : "ok");
      } catch {
        setState("error");
      }
    })();
  }, [authLoading, user, isAnonymous, code, navigate]);

  const name = inviter?.first_name || inviter?.username || "Twój znajomy";

  return (
    <div className="flex h-[100dvh] flex-col items-center justify-center px-8 gap-5 bg-background text-center max-w-sm mx-auto">
      {state === "working" ? (
        <>
          <Loader2 className="h-8 w-8 animate-spin text-orange-600" />
          <p className="text-sm text-muted-foreground">Dodajemy znajomego…</p>
        </>
      ) : state === "ok" || state === "already" ? (
        <>
          <div className="h-20 w-20 rounded-full overflow-hidden bg-orange-100 ring-4 ring-orange-100">
            <img src={avatarSrc(inviter?.avatar_url ?? null)} alt={name} className="w-full h-full object-cover" />
          </div>
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 text-green-600 font-bold text-sm">
              <UserCheck className="h-4 w-4" /> {state === "already" ? "Już jesteście znajomymi" : "Jesteście znajomymi!"}
            </div>
            <p className="text-2xl font-display font-extrabold tracking-tight leading-tight">
              Ty i&nbsp;{name} {state === "already" ? "" : "🎉"}
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Możecie teraz planować wspólne trasy jednym tapnięciem i&nbsp;podglądać swoje podróże.
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-[260px] mt-1">
            {inviter?.username && (
              <button
                onClick={() => navigate(`/profil/${inviter.username}`)}
                className="w-full px-6 py-3 rounded-full bg-primary text-white font-bold text-sm active:scale-95 transition-transform"
              >
                Zobacz profil {name}
              </button>
            )}
            <button
              onClick={() => navigate("/home")}
              className="w-full px-6 py-3 rounded-full bg-secondary text-secondary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              Przejdź do aplikacji <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </>
      ) : state === "self" ? (
        <>
          <p className="text-4xl">🙂</p>
          <p className="text-lg font-bold">To Twój własny link</p>
          <p className="text-sm text-muted-foreground">Wyślij go znajomym, żeby dodali Cię do listy.</p>
          <button onClick={() => navigate("/home")} className="mt-2 px-6 py-3 rounded-full bg-primary text-white font-bold text-sm">Strona główna</button>
        </>
      ) : (
        <>
          <p className="text-4xl">😕</p>
          <p className="text-lg font-bold">Link nieprawidłowy lub wygasł</p>
          <p className="text-sm text-muted-foreground">Poproś znajomego o&nbsp;nowy link zaproszeniowy.</p>
          <button onClick={() => navigate("/home")} className="mt-2 px-6 py-3 rounded-full bg-primary text-white font-bold text-sm">Strona główna</button>
        </>
      )}
    </div>
  );
}
