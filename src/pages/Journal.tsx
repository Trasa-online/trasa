import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { ArrowRight, BookOpen } from "lucide-react";
import JournalTab from "@/components/home/JournalTab";
import CitySelect from "@/components/home/CitySelect";
import TabTopBar from "@/components/layout/TabTopBar";
import { useActiveCity } from "@/hooks/useActiveCity";
import { useTranslation } from "react-i18next";
import { useOnboarding } from "@/components/OnboardingGuide";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

const Journal = () => {
  const { user, isAnonymous } = useAuth();
  const { open } = useAuthDrawer();
  const { t } = useTranslation("journal");
  const { active: onboardingActive } = useOnboarding();
  const [city, setCity] = useActiveCity();
  // Anon = traktuj jak gosc (zero zapisanych danych w UI). Dziennik wymaga
  // konta z mailem zeby trasy/pocztówki byly persystowane miedzy urzadzeniami.
  // WYJATEK: podczas onboardingu pokazujemy realny dziennik z fejk-wyjazdem.
  const isGuestView = (!user || isAnonymous) && !onboardingActive;

  // Guest: pelnoekranowy wycentrowany empty state, bez tytulu strony (TopBar tez ukryty na route /dziennik)
  if (isGuestView) {
    // Większy pb żeby empty state wygladał na realnie wycentrowany (bez tego
    // pb=5rem grupa landuje ~10-15% ponizej optycznego srodka - icon + tytul
    // sa lekkie, button na dole ciągnie wizualnie ku dolowi).
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 pb-[20vh] text-center">
        <div className="h-20 w-20 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center">
          <BookOpen className="h-9 w-9 text-orange-600" />
        </div>
        <div className="space-y-2 max-w-[320px]">
          <p className="text-2xl font-display font-extrabold tracking-tight leading-tight">{t("guest_title")}</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("guest_desc")}
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 w-full max-w-[280px]">
          <button
            onClick={() => open({ mode: "register", hint: "journal" })}
            className="w-full px-8 py-3.5 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            {t("register")}
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => open({ mode: "login", hint: "journal" })}
            className="w-full px-8 py-3.5 rounded-full bg-secondary text-secondary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            {t("login")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] overflow-y-auto">
      <TabTopBar>
        <CitySelect city={city} onCityChange={setCity} allowAll />
        <div className="flex-1" />
        <InfoTooltip title="Wyjazdy">
          {`Wyjazdy to Twoje trasy: te w przygotowaniu (Robocze) i te ukończone (Wspomnienia). Tu układasz wyjazd z miejsc, dodajesz zdjęcia i notki, a gotowy wyjazd możesz udostępnić innym. Pojedyncze miejsca na później zapisujesz w zakładce Zapisane.`}
        </InfoTooltip>
      </TabTopBar>
      <div className="px-4 pt-3">
        {user && <JournalTab userId={user.id} city={city} />}
      </div>
    </div>
  );
};

export default Journal;
