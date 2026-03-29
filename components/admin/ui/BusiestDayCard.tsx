import type { WeeklyOccupancyDay } from "@/lib/admin/dashboard/types";
import { parseDateOnly } from "@/lib/datetime/mexico-city";
import { REQUIRED_TIMEZONE } from "@/lib/constants/slots";
import type { AppLanguage } from "@/lib/i18n/config";

import { AdminIcon } from "./AdminIcon";
import { adminIcons } from "./admin-icons";

interface BusiestDayCardProps {
  language: AppLanguage;
  day: WeeklyOccupancyDay;
  title: string;
  subtitle: string;
}

const localeByLanguage: Record<AppLanguage, string> = {
  es: "es-MX",
  en: "en-US",
};

function formatWeekday(date: string, language: AppLanguage) {
  const locale = localeByLanguage[language] ?? localeByLanguage.es;
  const weekday = new Intl.DateTimeFormat(locale, {
    timeZone: REQUIRED_TIMEZONE,
    weekday: "long",
  }).format(parseDateOnly(date));

  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

export function BusiestDayCard({
  language,
  day,
  title,
  subtitle,
}: BusiestDayCardProps) {
  return (
    <section className="mb-6 flex items-center justify-between rounded-xl bg-[var(--admin-primary)] px-4 py-3 text-white shadow-sm">
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/70">
          {title}
        </p>
        <p className="mt-1 truncate text-[1.65rem] font-bold leading-[1.05]">
          {formatWeekday(day.date, language)}
        </p>
        <p className="mt-1 text-[11px] font-semibold text-white/80">
          {subtitle}
        </p>
      </div>

      <div className="ml-4 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/22">
        <AdminIcon icon={adminIcons.busiestDay} className="text-white" />
      </div>
    </section>
  );
}
