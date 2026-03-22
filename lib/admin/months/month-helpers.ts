import type { AppLanguage } from "@/lib/i18n/config";

export const MONTH_KEY_PATTERN = /^\d{4}-\d{2}$/;

export function toMonthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function getMonthYear(month: string) {
  return Number(month.slice(0, 4));
}

export function getFutureMonthsForYear(year: number, currentMonth: string) {
  const currentYear = getMonthYear(currentMonth);
  const currentMonthNumber = Number(currentMonth.slice(5, 7));
  const startMonth = year === currentYear ? currentMonthNumber + 1 : 1;

  if (startMonth > 12) {
    return [];
  }

  return Array.from({ length: 12 - startMonth + 1 }, (_, index) =>
    toMonthKey(year, startMonth + index),
  );
}

export function formatShortMonthLabel(month: string, language: AppLanguage) {
  const locale = language === "en" ? "en-US" : "es-MX";
  const date = new Date(`${month}-01T12:00:00.000Z`);
  const raw = new Intl.DateTimeFormat(locale, {
    month: "short",
    timeZone: "America/Mexico_City",
  }).format(date);

  const normalized = raw.replace(/\.$/, "");
  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}.`;
}
