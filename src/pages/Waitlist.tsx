import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().trim().email({ message: "Podaj poprawny adres email" });

// Custom hook for counting animation
const useCountUp = (target: number | null, duration: number = 1500) => {
  const [count, setCount] = useState(0);
  const previousTarget = useRef<number | null>(null);

  useEffect(() => {
    if (target === null || target === 0) return;

    const startValue = previousTarget.current ?? 0;
    const difference = target - startValue;
    
    if (difference <= 0) {
      setCount(target);
      previousTarget.current = target;
      return;
    }

    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentCount = Math.floor(startValue + difference * easeOut);
      setCount(currentCount);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(target);
        previousTarget.current = target;
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return count;
};

const Waitlist = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);
  const { toast } = useToast();

  const animatedCount = useCountUp(waitlistCount);

  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from("waitlist")
        .select("*", { count: "exact", head: true });
      setWaitlistCount(count);
    };
    fetchCount();
  }, [success]);

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
            <span className="text-xl">📍</span>
            <span className="text-sm font-medium">Wkrótce dostępna</span>
          </div>
        </div>

        {/* Description */}
        <div className="text-center space-y-2">
          <p className="text-lg text-muted-foreground">
            Twoje podróże. Jedna TRASA
          </p>
          <p className="text-sm text-muted-foreground">
            Odbierz zaproszenie do zamkniętej bety
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
              {loading ? "Zapisywanie..." : "Powiadom mnie o starcie"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </Button>
          </form>
        )}

        {/* Waitlist Counter */}
        {waitlistCount !== null && waitlistCount > 0 && (
          <p className="text-center text-sm text-muted-foreground">
            Już <span className="font-semibold text-foreground transition-all duration-300">{animatedCount}</span> {waitlistCount === 1 ? "osoba czeka" : "osób czeka"} na start
          </p>
        )}

      </div>
    </div>
  );
};

export default Waitlist;
