import { REQUIRED_TIMEZONE } from "@/lib/constants/slots";
import type { AppLanguage } from "@/lib/i18n/config";

interface DashboardGreetingCardProps {
  language: AppLanguage;
  dateTemplate: string;
  greeting: string;
}

const localeByLanguage: Record<AppLanguage, string> = {
  es: "es-MX",
  en: "en-US",
};

function formatDashboardDate(language: AppLanguage) {
  const locale = localeByLanguage[language] ?? localeByLanguage.es;
  const parts = new Intl.DateTimeFormat(locale, {
    timeZone: REQUIRED_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatToParts(new Date());

  const getPart = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    weekday: getPart("weekday"),
    day: getPart("day"),
    month: getPart("month"),
    year: getPart("year"),
    locale,
  };
}

export function DashboardGreetingCard({
  language,
  dateTemplate,
  greeting,
}: DashboardGreetingCardProps) {
  const { weekday, day, month, year, locale } = formatDashboardDate(language);
  const dateLabel = dateTemplate
    .replace("{{weekday}}", weekday)
    .replace("{{day}}", day)
    .replace("{{month}}", month)
    .replace("{{year}}", year)
    .toLocaleUpperCase(locale);

  return (
    <section className="mb-6">
      <p className="text-[10px] font-bold tracking-[0.14em] text-[var(--admin-text-secondary)]">
        {dateLabel}
      </p>
      <h2 className="mt-1 text-[2rem] font-bold leading-[1.03] tracking-[-0.03em] text-[var(--admin-text-primary)]">
        {greeting} <span className="text-[1.5rem]">😊 ✨</span>
      </h2>
    </section>
  );
}
