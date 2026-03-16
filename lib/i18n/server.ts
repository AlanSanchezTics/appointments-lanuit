import i18next, { type TFunction } from "i18next";

import { DEFAULT_LANGUAGE, type AppLanguage } from "@/lib/i18n/config";
import { i18nResources } from "@/lib/i18n/resources";

export async function getServerT(language: AppLanguage): Promise<TFunction> {
  const instance = i18next.createInstance();

  await instance.init({
    resources: i18nResources,
    lng: language,
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: "common",
    ns: ["common", "errors"],
    interpolation: {
      escapeValue: false,
    },
    returnEmptyString: false,
  });

  return instance.t;
}
