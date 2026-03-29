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

type LanguageSelectorProps = {
  variant?: "fab" | "inline";
};

export function LanguageSelector({ variant = "fab" }: LanguageSelectorProps) {
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

  const isInline = variant === "inline";
  const panelClasses = isInline
    ? "absolute right-0 top-[calc(100%+8px)] z-20 flex flex-col items-center gap-2 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 shadow-lg"
    : "flex flex-col items-center gap-2";
  const optionButtonClasses = isInline
    ? "outline-0 inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 shadow-sm transition"
    : "outline-0 inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-(--border) bg-white px-3 shadow-(--shadow-soft) transition";
  const triggerButtonClasses = isInline
    ? "outline-0 inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 text-sm shadow-sm transition ring-1 ring-[var(--admin-primary)]"
    : "outline-0 inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-(--border) bg-white px-3 shadow-(--shadow-soft) transition ring-2 ring-[var(--accent)]";
  const containerClasses = isInline
    ? "relative flex items-center"
    : "flex flex-col items-center gap-2";
  const activeRingClass = isInline ? "ring-2 ring-[var(--admin-primary)]" : "ring-2 ring-[var(--accent)]";

  return (
    <div className={containerClasses}>
      {isOpen ? (
        <div className={panelClasses}>
          <button
            aria-label={t("language.switchTo", {
              language: t("language.useSpanish"),
            })}
            className={`${optionButtonClasses} ${currentLanguage === "es" ? activeRingClass : ""}`}
            onClick={() => handleLanguageChange("es")}
            type="button"
          >
            {FLAG_BY_LANGUAGE.es}
          </button>
          <button
            aria-label={t("language.switchTo", {
              language: t("language.useEnglish"),
            })}
            className={`${optionButtonClasses} ${currentLanguage === "en" ? activeRingClass : ""}`}
            onClick={() => handleLanguageChange("en")}
            type="button"
          >
            {FLAG_BY_LANGUAGE.en}
          </button>
        </div>
      ) : null}

      <button
        aria-label={t("language.label")}
        className={triggerButtonClasses}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        {FLAG_BY_LANGUAGE[currentLanguage]}
      </button>
    </div>
  );
}
