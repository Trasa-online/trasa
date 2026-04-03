import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const CreateGroupSession = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedCity, setSelectedCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [createdCode, setCreatedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { data: cities = [] } = useQuery({
    queryKey: ["places-cities"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("places")
        .select("city")
        .eq("is_active", true);
      const unique = [...new Set((data || []).map((p: any) => p.city as string))].sort();
      return unique as string[];
    },
  });

  const handleCreate = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!selectedCity) { toast.error("Wybierz miasto"); return; }
    setLoading(true);
    try {
      const code = generateJoinCode();
      const { data: session, error } = await (supabase as any)
        .from("group_sessions")
        .insert({ city: selectedCity, created_by: user.id, join_code: code })
        .select()
        .single();
      if (error) throw error;

      // Creator auto-joins
      await (supabase as any)
        .from("group_session_members")
        .insert({ session_id: session.id, user_id: user.id });

      setCreatedCode(code);
    } catch (e: any) {
      toast.error(e.message || "Błąd podczas tworzenia sesji");
    } finally {
      setLoading(false);
    }
  };

  const shareUrl = createdCode ? `${window.location.origin}/sesja/${createdCode}` : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Skopiowano link!");
  };

  return (
    <div className="flex flex-col h-screen bg-background max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0 text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="font-bold text-base">Grupowe matchowanie</span>
      </div>

      <div className="flex-1 flex flex-col px-4 py-6 gap-6">
        {!createdCode ? (
          <>
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Wybierz miasto i stwórz sesję — każdy ze znajomych swipe'uje niezależnie, a wy zobaczycie wspólne dopasowania.
              </p>
              <p className="text-sm font-semibold mb-3">Miasto</p>
              <div className="flex flex-wrap gap-2">
                {cities.map((city) => (
                  <button
                    key={city}
                    onClick={() => setSelectedCity(city)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                      selectedCity === city
                        ? "bg-orange-600 text-white border-orange-600"
                        : "bg-card text-foreground border-border/60"
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleCreate}
              disabled={loading || !selectedCity}
              className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.97] transition-transform disabled:opacity-40"
            >
              {loading ? "Tworzę sesję…" : "Stwórz sesję grupową"}
            </button>
          </>
        ) : (
          <>
            <div className="text-center py-4">
              <p className="text-5xl mb-4">🎉</p>
              <p className="text-xl font-black mb-1">Sesja gotowa!</p>
              <p className="text-sm text-muted-foreground">
                Wyślij link znajomym, żeby dołączyli i razem swipe'owali miejsca w{" "}
                <strong>{selectedCity}</strong>.
              </p>
            </div>

            {/* Code display */}
            <div className="rounded-2xl border border-border bg-card p-5 text-center">
              <p className="text-xs text-muted-foreground mb-2">Kod sesji</p>
              <p className="text-4xl font-black tracking-widest mb-4">{createdCode}</p>
              <button
                onClick={handleCopy}
                className="w-full py-3 rounded-xl border border-border/60 bg-background text-sm font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                {copied ? "Skopiowano!" : "Kopiuj link zaproszenia"}
              </button>
            </div>

            <button
              onClick={() => navigate(`/sesja/${createdCode}`)}
              className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.97] transition-transform"
            >
              Zacznij swipe'ować
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default CreateGroupSession;
