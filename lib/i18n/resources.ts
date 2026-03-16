import commonEn from "@/locales/en/common.json";
import errorsEn from "@/locales/en/errors.json";
import commonEs from "@/locales/es/common.json";
import errorsEs from "@/locales/es/errors.json";

export const i18nResources = {
  es: {
    common: commonEs,
    errors: errorsEs,
  },
  en: {
    common: commonEn,
    errors: errorsEn,
  },
} as const;
