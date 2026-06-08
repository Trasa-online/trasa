// Hardcoded admin emails that should be able to use the consumer app
// regardless of having a business_profiles row. BusinessGuard / SplashController
// / Auth must NOT force-redirect these accounts to /biznes.
//
// BusinessDashboard.tsx keeps its own local copy of this set (file is FROZEN
// per CLAUDE.md, do not edit). Keep both lists in sync if you add an admin.
export const HARDCODED_ADMIN_EMAILS = new Set<string>([
  "nat.maz98@gmail.com",
  "tomalab97@gmail.com",
  "maciej.meszynski123@gmail.com",
]);

export function isHardcodedAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return HARDCODED_ADMIN_EMAILS.has(email);
}
