import { parseDateOnly } from "@/lib/datetime/mexico-city";
import type { AppLanguage } from "@/lib/i18n/config";
import type { WeeklyOccupancySummary } from "@/lib/admin/dashboard/types";
import { REQUIRED_TIMEZONE } from "@/lib/constants/slots";

import { AdminIcon } from "./AdminIcon";
import { Card } from "./Card";
import { adminIcons } from "./admin-icons";

interface WeeklyOccupancyCardProps {
  language: AppLanguage;
  data: WeeklyOccupancySummary;
  title: string;
  moreLabel: string;
  lessLabel: string;
  similarLabel: string;
  versusLabel: string;
  dayAppointmentsTooltip: string;
}

const localeByLanguage: Record<AppLanguage, string> = {
  es: "es-MX",
  en: "en-US",
};

function getWeekdayLabel(date: string, language: AppLanguage) {
  const locale = localeByLanguage[language] ?? localeByLanguage.es;

  return new Intl.DateTimeFormat(locale, {
    timeZone: REQUIRED_TIMEZONE,
    weekday: "short",
  })
    .format(parseDateOnly(date))
    .replace(".", "")
    .slice(0, 3)
    .toUpperCase();
}

function getDeltaLabel(deltaPercentPoints: number) {
  const absolute = Math.abs(deltaPercentPoints);

  if (deltaPercentPoints === 0) {
    return `${absolute}%`;
  }

  return `${absolute}%`;
}

function getDeltaIconClassName(deltaPercentPoints: number) {
  if (deltaPercentPoints > 0) {
    return "text-[var(--admin-success-text)]";
  }

  if (deltaPercentPoints < 0) {
    return "text-red-700";
  }

  return "text-[var(--admin-text-secondary)]";
}

function getDeltaIcon(deltaPercentPoints: number) {
  if (deltaPercentPoints > 0) {
    return adminIcons.trendUp;
  }

  if (deltaPercentPoints < 0) {
    return adminIcons.trendDown;
  }

  return adminIcons.trendNeutral;
}

function getDayTooltip(template: string, count: number) {
  return template.replace("{{count}}", String(count));
}

export function WeeklyOccupancyCard({
  language,
  data,
  title,
  versusLabel,
  dayAppointmentsTooltip,
}: WeeklyOccupancyCardProps) {
  const deltaLabel = getDeltaLabel(data.deltaPercentPoints);
  const deltaIcon = getDeltaIcon(data.deltaPercentPoints);
  const deltaIconClassName = getDeltaIconClassName(data.deltaPercentPoints);

  return (
    <Card className="mb-6">
      <div className="flex justify-between items-center">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--admin-text-secondary)]">
          {title}
        </h2>
        <div className="inline-flex items-center gap-1 rounded-full bg-[var(--admin-inactive-bg)] px-3 py-1.5 text-[var(--admin-text-primary)]">
          <AdminIcon icon={deltaIcon} className={deltaIconClassName} />
          <p className="text-sm font-extrabold leading-none">{deltaLabel}</p>
          <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--admin-text-secondary)]">
            {versusLabel}
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-5 gap-2">
        {data.days.map((day) => {
          const barHeight = Math.max(day.occupancyPercent, 8);
          const tooltipLabel = getDayTooltip(
            dayAppointmentsTooltip,
            day.occupiedSlots,
          );
          return (
            <div
              key={day.date}
              className="flex min-w-0 flex-col items-center gap-2"
            >
              <button
                type="button"
                title={tooltipLabel}
                aria-label={tooltipLabel}
                className="group relative flex h-24 w-full items-end rounded-xl bg-[var(--admin-inactive-bg)] p-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)]"
              >
                <span
                  role="tooltip"
                  className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 rounded-md bg-[var(--admin-text-primary)] px-2 py-1 text-[10px] font-semibold text-white opacity-0 shadow-sm transition group-hover:opacity-100 group-focus:opacity-100 group-active:opacity-100"
                >
                  {tooltipLabel}
                </span>
                <div
                  className="w-full rounded-lg bg-[var(--admin-accent)] transition-height duration-300"
                  style={{ height: `${barHeight}%` }}
                />
              </button>
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--admin-text-secondary)]">
                {getWeekdayLabel(day.date, language)}
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
