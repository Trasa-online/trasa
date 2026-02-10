export const getExpectationBadge = (value: string | null) => {
  switch (value) {
    case "yes": return { emoji: "😊", label: "Spełniło oczekiwania", className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
    case "average": return { emoji: "😐", label: "Średnio", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
    case "no": return { emoji: "😕", label: "Poniżej oczekiwań", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
    default: return null;
  }
};

export const getTripRoleBadge = (value: string | null) => {
  switch (value) {
    case "must_see": return { emoji: "⭐", label: "Punkt obowiązkowy", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
    case "nice_addition": return { emoji: "➕", label: "Fajny dodatek", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" };
    case "skippable": return { emoji: "🔁", label: "Można pominąć", className: "bg-muted text-muted-foreground" };
    default: return null;
  }
};

export const getRelativeTime = (dateStr: string): string => {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);

  if (minutes < 60) return "przed chwilą";
  if (hours < 24) return `${hours}h temu`;
  if (days < 7) return `${days} dni temu`;
  if (weeks < 5) return `${weeks} tyg. temu`;
  return `${months} mies. temu`;
};

// Collect unique tags from route pins (recommended_for + pros as fallback)
export const collectRouteTags = (pins: any[]): string[] => {
  const allRecommended = pins.flatMap((p: any) => p.recommended_for || []);
  const allPros = pins.flatMap((p: any) => p.pros || []);
  return [...new Set([...allRecommended, ...allPros])];
};
