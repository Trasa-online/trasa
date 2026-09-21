import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { fetchEnrichedPlace } from "@/components/plan-wizard/PlaceSwiper";
import type { MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import SavePlaceSheet, { type SavePlaceInput } from "@/components/plan-wizard/SavePlaceSheet";
import { BrandSpinner } from "@/components/BrandSpinner";
import { track } from "@/lib/analytics";
import { queryClient } from "@/lib/queryClient";

// KOD QR Z WIZYTOWKI DRUKOWANEJ (2026-09-21): universal link `spontaway.com/q/<token>` otwiera
// apke na tej trasie (`/q/:token`, patrz NativeDeepLinkHandler w App.tsx). Skan znaczy
// „jestem w tym miejscu", wiec:
//  1. `resolve_qr_code` oddaje miejsce (i zlicza skan),
//  2. `mark_qr_visit` odhacza odwiedziny bez GPS (place_visits.source = 'qr'),
//  3. otwiera sie PELNA wizytowka miejsca z „Zapisz to miejsce" (kolekcja / Ogolne) i udostepnianiem.
// Kod bez przypisanego miejsca albo nieznany -> toast i powrot do Eksploracji.
export default function QrPlace() {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation("wizytowka");
  const [place, setPlace] = useState<MockPlace | null>(null);
  const [failed, setFailed] = useState(false);
  const [savePlace, setSavePlace] = useState<SavePlaceInput | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await (supabase as any).rpc("resolve_qr_code", { p_token: token });
      const row = Array.isArray(data) ? data[0] : null;
      if (error || !row?.place_id) { if (!cancelled) setFailed(true); return; }
      track("qr_scanned", { token, place_id: row.place_id, logged_in: !!user });
      const full = await fetchEnrichedPlace(row.place_id, new Date().toISOString().slice(0, 10));
      if (cancelled) return;
      if (!full) { setFailed(true); return; }
      setPlace(full);
      if (user) {
        // Best-effort: odwiedziny z kodu. Blad nie psuje wizytowki.
        void (supabase as any).rpc("mark_qr_visit", { p_token: token })
          .then(() => { queryClient.invalidateQueries({ queryKey: ["place-visits"] }); queryClient.invalidateQueries({ queryKey: ["collection-visits"] }); })
          .catch(() => {});
      }
    })();
    return () => { cancelled = true; };
  }, [token, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!failed) return;
    toast.error(t("qr.unknown"));
    navigate("/eksploruj", { replace: true });
  }, [failed, navigate, t]);

  const close = () => navigate("/eksploruj", { replace: true });

  if (!place) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-background">
        <BrandSpinner size={40} />
      </div>
    );
  }
  return (
    <div className="min-h-[100dvh] bg-background">
      <PlaceSwiperDetail
        open
        onOpenChange={(o) => { if (!o) close(); }}
        place={place}
        city={place.city ?? ""}
        onLike={user ? () => setSavePlace({
          place_name: place.place_name, category: (place as any).category ?? null, address: (place as any).address ?? null,
          city: place.city ?? null, latitude: (place as any).latitude ?? null, longitude: (place as any).longitude ?? null,
          photo_url: (place as any).photo_url ?? null, place_id: place.id ?? null,
        }) : undefined}
      />
      <SavePlaceSheet open={!!savePlace} onOpenChange={(o) => { if (!o) setSavePlace(null); }} place={savePlace} city={place.city ?? ""} />
    </div>
  );
}
