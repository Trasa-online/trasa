import { supabase } from "@/integrations/supabase/client";

/**
 * Docelowa sciezka panelu dla wlasciciela biznesu.
 *
 * Onboarding (`/biznes/onboarding/:id`) pokazuje sie dopoki biznes nie przeszedl
 * przez niego (profiles.onboarding_completed !== true) - czyli przy pierwszych
 * logowaniach. Po ukonczeniu onboardingu (BusinessOnboarding.enterPanel ustawia
 * flage) kolejne logowania ida prosto do panelu `/biznes/:id`.
 *
 * Uzywane spojnie we wszystkich miejscach redirectu biznesu (Auth, App boot,
 * BusinessGuard, SetPassword), zeby regula byla jedna.
 */
export async function businessPanelPath(
  userId: string,
  bp: { place_id: string | null; id: string },
): Promise<string> {
  const base = bp.place_id ?? bp.id;
  const { data: prof } = await (supabase as any)
    .from("profiles")
    .select("onboarding_completed")
    .eq("id", userId)
    .maybeSingle();
  return prof?.onboarding_completed ? `/biznes/${base}` : `/biznes/onboarding/${base}`;
}
