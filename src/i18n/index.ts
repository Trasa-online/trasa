import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import pl_common from "../locales/pl/common.json";
import pl_onboarding from "../locales/pl/onboarding.json";
import pl_home from "../locales/pl/home.json";
import pl_auth from "../locales/pl/auth.json";
import pl_settings from "../locales/pl/settings.json";
import pl_create_route from "../locales/pl/create-route.json";

import en_common from "../locales/en/common.json";
import en_onboarding from "../locales/en/onboarding.json";
import en_home from "../locales/en/home.json";
import en_auth from "../locales/en/auth.json";
import en_settings from "../locales/en/settings.json";
import en_create_route from "../locales/en/create-route.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pl: {
        common: pl_common,
        onboarding: pl_onboarding,
        home: pl_home,
        auth: pl_auth,
        settings: pl_settings,
        "create-route": pl_create_route,
      },
      en: {
        common: en_common,
        onboarding: en_onboarding,
        home: en_home,
        auth: en_auth,
        settings: en_settings,
        "create-route": en_create_route,
      },
    },
    fallbackLng: "pl",
    supportedLngs: ["pl", "en"],
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
