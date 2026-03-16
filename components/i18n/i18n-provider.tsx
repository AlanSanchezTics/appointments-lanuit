"use client";

import { useEffect } from "react";
import { I18nextProvider } from "react-i18next";

import { type AppLanguage } from "@/lib/i18n/config";
import { initializeClientI18n } from "@/lib/i18n/client";
import { resolveClientLanguage, persistLanguage } from "@/lib/i18n/language";

type I18nProviderProps = {
  initialLanguage: AppLanguage;
  children: React.ReactNode;
};

export function I18nProvider({ initialLanguage, children }: I18nProviderProps) {
  const i18n = initializeClientI18n(initialLanguage);

  useEffect(() => {
    const detectedLanguage = resolveClientLanguage();

    if (i18n.language !== detectedLanguage) {
      void i18n.changeLanguage(detectedLanguage);
    }
    persistLanguage(detectedLanguage);
    document.documentElement.lang = detectedLanguage;
  }, [i18n]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
