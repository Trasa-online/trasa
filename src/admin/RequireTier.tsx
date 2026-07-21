import type { ReactNode } from "react";
import { useAdmin, type AdminTier } from "./RequireAdmin";

// Bramka per-tier dla akcji w UI. UWAGA: to tylko warstwa UX - realne
// egzekwowanie MUSI zostac w edge functions / RLS (UI da sie ominac).
// Uzycie: <RequireTier tier="super_admin"><button ...>Usun</button></RequireTier>
export function RequireTier({
  tier,
  children,
  fallback = null,
}: {
  tier: AdminTier;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { isSuperAdmin } = useAdmin();
  // Na razie 2 tiery: operator < super_admin. Tylko super_admin przechodzi gate
  // super_admin; operator przechodzi gate operator (wszyscy admini sa >= operator).
  const ok = tier === "super_admin" ? isSuperAdmin : true;
  return <>{ok ? children : fallback}</>;
}
