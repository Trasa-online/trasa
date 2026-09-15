import { supabase } from "@/integrations/supabase/client";

// Awatary brandowe do wyboru (prosba Nat 2026-09-13): SAME KOLORY z palety marki, bez znaku
// (decyzja Nat - wersja ze znakiem "S" odrzucona tego samego dnia). Pliki generuje
// scripts/gen_avatar_presets.py (public/avatars/preset-<id>.png), a ich kopie leza w buckecie
// `avatars/presets/v2/` - profil zapisuje PELNY adres, tak samo jak przy wlasnym zdjeciu, wiec
// strona linku, powiadomienia i cudze telefony widza ten sam plik. Wersja w sciezce (v2), bo
// pliki ida z cache na rok - podmiana pod tym samym adresem nie dotarlaby do telefonow.
// Nowy wariant = wpis tutaj + wygenerowany i wgrany plik; nowy wyglad = nowy folder wersji.
export const AVATAR_PRESET_IDS = ["sun", "orange", "brick", "brown", "pink", "blush", "peach", "terracotta", "gold", "purple", "blue", "green"] as const;
export type AvatarPresetId = (typeof AVATAR_PRESET_IDS)[number];

export function presetAvatarUrl(id: AvatarPresetId): string {
  return supabase.storage.from("avatars").getPublicUrl(`presets/v2/preset-${id}.png`).data.publicUrl;
}

/** Czy adres awatara to jeden z presetow (bez parametrow cache-bust). */
export function isPresetAvatar(url: string | null | undefined): boolean {
  return typeof url === "string" && url.includes("/avatars/presets/");
}
