import commonEn from "@/locales/en/common.json";
import errorsEn from "@/locales/en/errors.json";
import adminEn from "@/locales/en/admin.json";
import adminErrorsEn from "@/locales/en/admin-errors.json";
import commonEs from "@/locales/es/common.json";
import errorsEs from "@/locales/es/errors.json";
import adminEs from "@/locales/es/admin.json";
import adminErrorsEs from "@/locales/es/admin-errors.json";

export const i18nResources = {
  es: {
    common: commonEs,
    errors: errorsEs,
    admin: adminEs,
    adminErrors: adminErrorsEs,
  },
  en: {
    common: commonEn,
    errors: errorsEn,
    admin: adminEn,
    adminErrors: adminErrorsEn,
  },
} as const;
