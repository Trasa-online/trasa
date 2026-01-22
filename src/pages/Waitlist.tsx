import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Mail, Rocket, ArrowRight, CheckCircle2 } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().trim().email({ message: "Podaj poprawny adres email" });

const Waitlist = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = emailSchema.safeParse(email);
    if (!validation.success) {
      toast({
        title: "Błąd",
        description: validation.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from("waitlist")
        .insert({ email: validation.data });

      if (error) {
        if (error.code === "23505") {
          toast({
            title: "Jesteś już na liście!",
            description: "Ten email został już zapisany na waitlistę.",
          });
        } else {
          throw error;
        }
      } else {
        setSuccess(true);
        toast({
          title: "Dziękujemy!",
          description: "Powiadomimy Cię gdy aplikacja będzie gotowa.",
        });
      }
    } catch (error: any) {
      toast({
        title: "Błąd",
        description: "Nie udało się zapisać na listę. Spróbuj ponownie.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 -mt-16">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-foreground">
            TRASA
          </h1>
          <div className="flex items-center justify-center gap-2 text-primary">
            <Rocket className="h-5 w-5" />
            <span className="text-sm font-medium">Wkrótce dostępna</span>
          </div>
        </div>

        {/* Description */}
        <div className="text-center space-y-2">
          <p className="text-lg text-muted-foreground">
            Twórz i udostępniaj trasy podróży ze znajomymi
          </p>
          <p className="text-sm text-muted-foreground">
            Zostaw email, a powiadomimy Cię gdy aplikacja będzie gotowa do użycia.
          </p>
        </div>

        {/* Form or Success State */}
        {success ? (
          <div className="bg-primary/10 rounded-xl p-6 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">Zapisano!</p>
              <p className="text-sm text-muted-foreground">
                Otrzymasz powiadomienie gdy TRASA będzie gotowa.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="email"
                placeholder="twoj@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10 h-12 text-base"
                disabled={loading}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full h-12 text-base gap-2"
              disabled={loading}
            >
              {loading ? "Zapisywanie..." : "Powiadom mnie"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        )}

      </div>
    </div>
  );
};

export default Waitlist;
