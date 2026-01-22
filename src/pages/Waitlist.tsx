import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { Mail, ArrowRight, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import confetti from "canvas-confetti";

const emailSchema = z.string().trim().email({ message: "Podaj poprawny adres email" });

// Custom hook for counting animation
const useCountUp = (target: number | null, duration: number = 1500) => {
  const [count, setCount] = useState(0);
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (target === null) return;
    if (target === 0) {
      setCount(0);
      return;
    }

    // Only animate on first load, not on updates
    if (hasAnimated.current) {
      setCount(target);
      return;
    }

    hasAnimated.current = true;
    const startTime = performance.now();
    
    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease-out cubic for smooth deceleration
      const easeOut = 1 - Math.pow(1 - progress, 3);
      
      const currentCount = Math.floor(target * easeOut);
      setCount(currentCount);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setCount(target);
      }
    };

    requestAnimationFrame(animate);
  }, [target, duration]);

  return count;
};

// Confetti celebration function
const triggerConfetti = () => {
  const duration = 2000;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 3,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.7 },
      colors: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
    });
    confetti({
      particleCount: 3,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.7 },
      colors: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };

  // Initial burst
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#ffffff'],
  });

  frame();
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
        triggerConfetti();
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

        {/* Waitlist Counter - always visible */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 bg-muted/50 rounded-full px-4 py-2">
            <span className="text-2xl font-bold text-primary">{animatedCount}</span>
            <span className="text-muted-foreground">/</span>
            <span className="text-lg font-medium text-muted-foreground">50</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {waitlistCount === null ? "Ładowanie..." : "miejsc w zamkniętej becie"}
          </p>
        </div>

      </div>
    </div>
  );
};

export default Waitlist;
