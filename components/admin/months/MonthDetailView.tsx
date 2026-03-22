"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { Button } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Card";
import { adminIcons } from "@/components/admin/ui/admin-icons";
import { useMonthDetail } from "@/hooks/admin/months/useMonthDetail";
import { formatMonthLabel } from "@/lib/datetime/mexico-city";
import type { AppLanguage } from "@/lib/i18n/config";
import type {
  MonthDetailCalendarDay,
  MonthDetailResponse,
} from "@/lib/admin/months/types";

type MonthDetailViewProps = {
  month: string;
  initialData: MonthDetailResponse;
};

const weekdayOrder = [0, 1, 2, 3, 4, 5, 6];

function resolveAppLanguage(language: string): AppLanguage {
  return language === "en" ? "en" : "es";
}

function getToneClasses(tone: MonthDetailCalendarDay["tone"]) {
  switch (tone) {
    case "available":
      return "bg-[var(--admin-availability-high)] text-[var(--admin-success-text)]";
    case "low":
      return "bg-[var(--admin-availability-low)] text-[#5b4600]";
    case "full":
      return "bg-[var(--admin-availability-full)] text-[#7f1d1d]";
    case "weekend":
      return "bg-[var(--admin-availability-weekend)] text-[rgba(107,114,128,0.85)]";
    default:
      return "bg-[var(--admin-inactive-bg)] text-[var(--admin-text-secondary)]";
  }
}

function buildCalendarCells(
  month: string,
  calendarDays: MonthDetailCalendarDay[],
) {
  const firstDate = new Date(`${month}-01T12:00:00.000Z`);
  const firstWeekday = firstDate.getUTCDay();
  const leadingPlaceholders = Array.from(
    { length: firstWeekday },
    (_, index) => ({
      key: `leading-${index}`,
      day: null as number | null,
    }),
  );

  const dayCells = calendarDays.map((day) => ({
    key: day.date,
    day,
  }));

  return [...leadingPlaceholders, ...dayCells];
}

export function MonthDetailView({ month, initialData }: MonthDetailViewProps) {
  const { t, i18n } = useTranslation("admin");
  const language = resolveAppLanguage(i18n.resolvedLanguage ?? "es");
  const { data, isLoading, errorCode, refresh } = useMonthDetail({
    month,
    initialData,
  });

  const monthTitle = formatMonthLabel(data.month, language);
  const calendarCells = useMemo(
    () => buildCalendarCells(data.month, data.calendarDays),
    [data.calendarDays, data.month],
  );

  return (
    <main className="mx-auto flex w-full max-w-[412px] flex-col gap-4 px-3 py-4">
      <section className="flex items-center gap-2">
        <Link
          href="/admin/months"
          aria-label={t("monthsDetail.header.back")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-accent)] transition hover:bg-[var(--admin-inactive-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)]"
        >
          <AdminIcon icon={adminIcons.back} />
        </Link>
        <h1 className="text-2xl font-bold text-[var(--admin-accent)]">
          {monthTitle}
        </h1>
        {data.isPastMonth ? (
          <span className="ml-auto rounded-full bg-[var(--admin-inactive-bg)] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--admin-text-secondary)]">
            {t("monthsDetail.header.historical")}
          </span>
        ) : null}
      </section>

      {errorCode ? (
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-[var(--admin-text-primary)]">
            {t("monthsDetail.errors.loadFailed")}
          </p>
          <p className="text-xs text-[var(--admin-text-secondary)]">
            {errorCode}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={refresh}
            disabled={isLoading}
          >
            {t("monthsDetail.errors.retry")}
          </Button>
        </Card>
      ) : null}

      <section className="grid grid-cols-2 gap-3">
        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <AdminIcon
              icon={adminIcons.monthDetailConfirmed}
              tone="accent"
              className="text-green-700"
            />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-secondary)]">
              {t("monthsDetail.metrics.confirmed")}
            </span>
          </div>
          <p className="text-3xl font-extrabold leading-none text-[var(--admin-text-primary)]">
            {data.metrics.confirmedAppointments.toString().padStart(2, "0")}
          </p>
        </Card>

        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <AdminIcon
              icon={adminIcons.monthDetailCancelled}
              tone="accent"
              className="text-red-700"
            />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-secondary)]">
              {t("monthsDetail.metrics.cancelled")}
            </span>
          </div>
          <p className="text-3xl font-extrabold leading-none text-[var(--admin-text-primary)]">
            {data.metrics.cancelledAppointments.toString().padStart(2, "0")}
          </p>
        </Card>

        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <AdminIcon icon={adminIcons.monthDetailAvailable} tone="primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-secondary)]">
              {t("monthsDetail.metrics.available")}
            </span>
          </div>
          <p className="text-3xl font-extrabold leading-none text-[var(--admin-text-primary)]">
            {data.metrics.availableSpaces.toString().padStart(2, "0")}
          </p>
        </Card>

        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <AdminIcon icon={adminIcons.monthDetailBlocked} tone="secondary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-secondary)]">
              {t("monthsDetail.metrics.blocked")}
            </span>
          </div>
          <p className="text-3xl font-extrabold leading-none text-[var(--admin-text-primary)]">
            {data.metrics.blockedSpaces.toString().padStart(2, "0")}
          </p>
        </Card>
      </section>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--admin-text-primary)]">
            {t("monthsDetail.saturation.title")}
          </h2>
          <span className="text-2xl font-extrabold text-[var(--admin-accent)]">
            {data.projectedSaturationPercent}%
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[var(--admin-inactive-bg)]">
          <div
            className="h-full rounded-full bg-[var(--admin-accent)] transition-[width] duration-300"
            style={{ width: `${data.projectedSaturationPercent}%` }}
            role="progressbar"
            aria-valuenow={data.projectedSaturationPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("monthsDetail.saturation.ariaLabel")}
          />
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="text-xl font-bold text-[var(--admin-text-primary)]">
          {t("monthsDetail.calendar.title")}
        </h2>

        <div className="grid grid-cols-7 gap-1.5 text-center">
          {weekdayOrder.map((weekday) => (
            <span
              key={weekday}
              className="text-[11px] font-bold uppercase tracking-widest text-[var(--admin-text-secondary)]"
            >
              {t(`monthsDetail.calendar.weekdays.${weekday}`)}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {calendarCells.map((cell) => {
            if (!("day" in cell) || !cell.day) {
              return (
                <div key={cell.key} className="h-11 rounded-lg" aria-hidden />
              );
            }

            return (
              <div
                key={cell.key}
                className={`flex h-11 items-center justify-center rounded-lg border border-transparent text-sm font-semibold ${getToneClasses(cell.day.tone)}`}
                title={cell.day.date}
              >
                {cell.day.day}
              </div>
            );
          })}
        </div>
      </Card>
    </main>
  );
}
