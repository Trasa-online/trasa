import { useState } from "react";
import { useTranslation } from "react-i18next";
import HomeTour, { useHomeTour } from "@/components/home/HomeTour";
import ProfileSetup, { useProfileSetup } from "@/components/home/ProfileSetup";
import { useAuth } from "@/hooks/useAuth";

// Onboarding nowego usera: najpierw intro (czym jest apka), potem setup profilu.
// Montowany na landingu (Eksploruj), bo tam laduje kazdy nowy user po zalogowaniu.
const OnboardingOverlay = () => {
  const { t } = useTranslation("homefeed");
  const { user, isAnonymous } = useAuth();
  const isGuest = !user || isAnonymous;
  const { showTour, dismissTour } = useHomeTour(isGuest);
  const { showSetup, finishSetup } = useProfileSetup();
  const [introSeen, setIntroSeen] = useState(false);

  return (
    <>
      {showTour && <HomeTour onDone={dismissTour} />}
      {showSetup && !introSeen && <HomeTour lastLabel={t("onboarding_next")} onDone={() => setIntroSeen(true)} />}
      {showSetup && introSeen && <ProfileSetup onDone={finishSetup} />}
    </>
  );
};

export default OnboardingOverlay;
