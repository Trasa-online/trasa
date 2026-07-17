import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import pl_common from "../locales/pl/common.json";
import pl_onboarding from "../locales/pl/onboarding.json";
import pl_home from "../locales/pl/home.json";
import pl_hometrip from "../locales/pl/hometrip.json";
import pl_auth from "../locales/pl/auth.json";
import pl_settings from "../locales/pl/settings.json";
import pl_create_route from "../locales/pl/create-route.json";
import pl_explore from "../locales/pl/explore.json";
import pl_plan from "../locales/pl/plan.json";
import pl_wizytowka from "../locales/pl/wizytowka.json";
import pl_journal from "../locales/pl/journal.json";
import pl_activetrip from "../locales/pl/activetrip.json";
import pl_nav from "../locales/pl/nav.json";
import pl_profiles from "../locales/pl/profiles.json";
import pl_myplan from "../locales/pl/myplan.json";
import pl_group from "../locales/pl/group.json";
import pl_groupcreate from "../locales/pl/groupcreate.json";
import pl_review from "../locales/pl/review.json";
import pl_ranking from "../locales/pl/ranking.json";
import pl_sharing from "../locales/pl/sharing.json";
import pl_demo from "../locales/pl/demo.json";
import pl_routechat from "../locales/pl/routechat.json";
import pl_route from "../locales/pl/route.json";
import pl_routelist from "../locales/pl/routelist.json";
import pl_social from "../locales/pl/social.json";
import pl_homefeed from "../locales/pl/homefeed.json";
import pl_homeprofile from "../locales/pl/homeprofile.json";
import pl_homecreator from "../locales/pl/homecreator.json";

import en_common from "../locales/en/common.json";
import en_onboarding from "../locales/en/onboarding.json";
import en_home from "../locales/en/home.json";
import en_hometrip from "../locales/en/hometrip.json";
import en_auth from "../locales/en/auth.json";
import en_settings from "../locales/en/settings.json";
import en_create_route from "../locales/en/create-route.json";
import en_explore from "../locales/en/explore.json";
import en_plan from "../locales/en/plan.json";
import en_wizytowka from "../locales/en/wizytowka.json";
import en_journal from "../locales/en/journal.json";
import en_activetrip from "../locales/en/activetrip.json";
import en_nav from "../locales/en/nav.json";
import en_profiles from "../locales/en/profiles.json";
import en_myplan from "../locales/en/myplan.json";
import en_group from "../locales/en/group.json";
import en_groupcreate from "../locales/en/groupcreate.json";
import en_review from "../locales/en/review.json";
import en_ranking from "../locales/en/ranking.json";
import en_sharing from "../locales/en/sharing.json";
import en_demo from "../locales/en/demo.json";
import en_routechat from "../locales/en/routechat.json";
import en_route from "../locales/en/route.json";
import en_routelist from "../locales/en/routelist.json";
import en_social from "../locales/en/social.json";
import en_homefeed from "../locales/en/homefeed.json";
import en_homeprofile from "../locales/en/homeprofile.json";
import en_homecreator from "../locales/en/homecreator.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      pl: {
        common: pl_common,
        onboarding: pl_onboarding,
        home: pl_home,
        hometrip: pl_hometrip,
        auth: pl_auth,
        settings: pl_settings,
        "create-route": pl_create_route,
        explore: pl_explore,
        plan: pl_plan,
        wizytowka: pl_wizytowka,
        journal: pl_journal,
        activetrip: pl_activetrip,
        nav: pl_nav,
        profiles: pl_profiles,
        myplan: pl_myplan,
        group: pl_group,
        groupcreate: pl_groupcreate,
        review: pl_review,
        ranking: pl_ranking,
        sharing: pl_sharing,
        demo: pl_demo,
        routechat: pl_routechat,
        route: pl_route,
        routelist: pl_routelist,
        social: pl_social,
        homefeed: pl_homefeed,
        homeprofile: pl_homeprofile,
        homecreator: pl_homecreator,
      },
      en: {
        common: en_common,
        onboarding: en_onboarding,
        home: en_home,
        hometrip: en_hometrip,
        auth: en_auth,
        settings: en_settings,
        "create-route": en_create_route,
        explore: en_explore,
        plan: en_plan,
        wizytowka: en_wizytowka,
        journal: en_journal,
        activetrip: en_activetrip,
        nav: en_nav,
        profiles: en_profiles,
        myplan: en_myplan,
        group: en_group,
        groupcreate: en_groupcreate,
        review: en_review,
        ranking: en_ranking,
        sharing: en_sharing,
        demo: en_demo,
        routechat: en_routechat,
        route: en_route,
        routelist: en_routelist,
        social: en_social,
        homefeed: en_homefeed,
        homeprofile: en_homeprofile,
        homecreator: en_homecreator,
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
