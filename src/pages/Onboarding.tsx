import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const FOOD_PREFS = [
  { id: "vege", label: "Wegetarianin" },
  { id: "vegan", label: "Vegan" },
  { id: "coffee", label: "Coffee snob" },
  { id: "local_food", label: "Kuchnia lokalna" },
  { id: "street_food", label: "Street food" },
  { id: "fine_dining", label: "Fine dining" },
  { id: "lactose_free", label: "Bez laktozy" },
  { id: "gluten_free", label: "Bezglutenowo" },
];

const INTERESTS = [
  { id: "history", label: "Historia" },
  { id: "art", label: "Sztuka" },
  { id: "nature", label: "Natura" },
  { id: "shopping", label: "Zakupy" },
  { id: "nightlife", label: "Nocne życie" },
  { id: "photography", label: "Fotografia" },
  { id: "architecture", label: "Architektura" },
  { id: "music", label: "Muzyka" },
];

const TRAVEL_STYLE = [
  { id: "intensive", label: "Intensywny" },
  { id: "relaxed", label: "Spokojny" },
  { id: "family", label: "Rodzinny" },
  { id: "romantic", label: "Romantyczny" },
  { id: "budget", label: "Budżetowy" },
  { id: "luxury", label: "Luksusowy" },
];

const Chip = ({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "px-3.5 py-2 rounded-full text-sm font-medium border transition-colors",
      selected
        ? "bg-foreground text-background border-foreground"
        : "bg-card text-foreground border-border hover:bg-muted"
    )}
  >
    {label}
  </button>
);

const Section = ({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: { id: string; label: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) => (
  <div className="mb-7">
    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
      {title}
    </p>
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <Chip
          key={item.id}
          label={item.label}
          selected={selected.has(item.id)}
          onClick={() => onToggle(item.id)}
        />
      ))}
    </div>
  </div>
);

const Onboarding = () => {
  const navigate = useNavigate();
  const [foodSelected, setFoodSelected] = useState<Set<string>>(new Set());
  const [interestsSelected, setInterestsSelected] = useState<Set<string>>(new Set());
  const [styleSelected, setStyleSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggle = (set: Set<string>, setFn: (s: Set<string>) => void, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setFn(next);
  };

  const handleSave = async (skip = false) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/"); return; }

      await supabase.from("profiles").update({
        dietary_prefs: skip ? [] : Array.from(foodSelected),
        travel_interests: skip ? [] : [...Array.from(interestsSelected), ...Array.from(styleSelected)],
        onboarding_completed: true,
      }).eq("id", user.id);
    } catch (err) {
      console.error("Failed to save preferences:", err);
    }
    navigate(skip ? "/" : "/?tour=1");
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 overflow-y-auto px-5 pt-10 pb-32">
        <h1 className="text-3xl font-black tracking-tight mb-1">Cześć!</h1>
        <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
          Opowiedz nam o sobie — AI dopasuje plan do Twoich upodobań.
        </p>

        <Section
          title="Jedzenie i napoje"
          items={FOOD_PREFS}
          selected={foodSelected}
          onToggle={(id) => toggle(foodSelected, setFoodSelected, id)}
        />

        <Section
          title="Co lubisz zwiedzać"
          items={INTERESTS}
          selected={interestsSelected}
          onToggle={(id) => toggle(interestsSelected, setInterestsSelected, id)}
        />

        <Section
          title="Styl podróżowania"
          items={TRAVEL_STYLE}
          selected={styleSelected}
          onToggle={(id) => toggle(styleSelected, setStyleSelected, id)}
        />
      </div>

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border px-5 py-4 flex flex-col gap-2">
        <Button
          onClick={() => handleSave(false)}
          disabled={saving}
          className="w-full rounded-full font-semibold"
        >
          {saving ? "Zapisuję..." : "Zacznij planować!"}
        </Button>
        <button
          type="button"
          onClick={() => handleSave(true)}
          disabled={saving}
          className="text-sm text-muted-foreground text-center py-1"
        >
          Pomiń
        </button>
      </div>
    </div>
  );
};

export default Onboarding;
