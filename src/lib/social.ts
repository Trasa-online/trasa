// Buduje linki do social mediow z tego co wpisze lokal - handle (@nyszje), sama nazwa,
// albo pelny URL. Dzieki temu biznes nie musi wklejac calego linku.

const isUrl = (v: string) => /^https?:\/\//i.test(v);
const clean = (v: string) => v.trim().replace(/^@/, "").trim();

// Instagram: "@nyszje" / "nyszje" -> https://instagram.com/nyszje. Pelny URL zostaje.
export function instagramUrl(value?: string | null): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (isUrl(v)) return v;
  if (/instagram\.com/i.test(v)) return `https://${v.replace(/^\/+/, "")}`;
  return `https://instagram.com/${clean(v)}`;
}

// Facebook: handle/username (bez spacji) -> profil facebook.com/<handle>. Sama NAZWA (ze spacjami)
// -> wyszukiwarka FB, zeby uzytkownik znalazl strone. Pelny URL zostaje.
export function facebookUrl(value?: string | null): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (isUrl(v)) return v;
  if (/facebook\.com/i.test(v)) return `https://${v.replace(/^\/+/, "")}`;
  const handle = clean(v);
  if (/\s/.test(handle)) return `https://www.facebook.com/search/top?q=${encodeURIComponent(handle)}`;
  return `https://facebook.com/${handle}`;
}
