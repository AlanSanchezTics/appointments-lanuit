"use client";

import i18next from "i18next";
import { initReactI18next } from "react-i18next";

import { DEFAULT_LANGUAGE, type AppLanguage } from "@/lib/i18n/config";
import { resolveClientLanguage } from "@/lib/i18n/language";
import { i18nResources } from "@/lib/i18n/resources";

let initialized = false;

export function initializeClientI18n(initialLanguage?: AppLanguage) {
  if (initialized) {
    return i18next;
  }

  i18next.use(initReactI18next).init({
    resources: i18nResources,
    lng: initialLanguage ?? resolveClientLanguage(),
    fallbackLng: DEFAULT_LANGUAGE,
    defaultNS: "common",
    ns: ["common", "errors", "admin", "adminErrors"],
    interpolation: {
      escapeValue: false,
    },
    returnEmptyString: false,
  });

  initialized = true;

  return i18next;
}
