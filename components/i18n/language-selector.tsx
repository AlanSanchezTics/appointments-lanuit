"use client";

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";

import { type AppLanguage } from "@/lib/i18n/config";
import { persistLanguage } from "@/lib/i18n/language";

const FLAG_BY_LANGUAGE: Record<AppLanguage, string> = {
  es: "🇲🇽",
  en: "🇺🇸",
};

export function LanguageSelector() {
  const router = useRouter();
  const { i18n, t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);

  const currentLanguage = useMemo<AppLanguage>(() => {
    return i18n.language.startsWith("en") ? "en" : "es";
  }, [i18n.language]);

  function handleLanguageChange(language: AppLanguage) {
    void i18n.changeLanguage(language);
    persistLanguage(language);
    document.documentElement.lang = language;
    setIsOpen(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {isOpen ? (
        <div className="flex flex-col items-center gap-2">
          <button
            aria-label={t("language.switchTo", {
              language: t("language.useSpanish"),
            })}
            className={`outline-0 inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-(--border) bg-white px-3 shadow-(--shadow-soft) transition ${currentLanguage === "es" ? "ring-2 ring-[var(--accent)]" : ""}`}
            onClick={() => handleLanguageChange("es")}
            type="button"
          >
            {FLAG_BY_LANGUAGE.es}
          </button>
          <button
            aria-label={t("language.switchTo", {
              language: t("language.useEnglish"),
            })}
            className={`outline-0 inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-(--border) bg-white px-3 shadow-(--shadow-soft) transition ${currentLanguage === "en" ? "ring-2 ring-[var(--accent)]" : ""}`}
            onClick={() => handleLanguageChange("en")}
            type="button"
          >
            {FLAG_BY_LANGUAGE.en}
          </button>
        </div>
      ) : null}

      <button
        aria-label={t("language.label")}
        className="outline-0 inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-(--border) bg-white px-3 shadow-(--shadow-soft) transition ring-2 ring-[var(--accent)]"
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        {FLAG_BY_LANGUAGE[currentLanguage]}
      </button>
    </div>
  );
}
