"use client";

import { useTranslation } from "react-i18next";

import { formatPhoneForDisplay } from "@/lib/booking/formatters";
import { formatTimeSlotLabel } from "@/lib/datetime/mexico-city";
import type { DashboardReminderItem } from "@/lib/admin/dashboard/types";
import type { AppLanguage } from "@/lib/i18n/config";
import { useReminderAppointments } from "@/hooks/admin/useReminderAppointments";

import { AdminIcon } from "./AdminIcon";
import { adminIcons } from "./admin-icons";

type ReminderAppointmentsCardProps = {
  language: AppLanguage;
  nextDayItems: DashboardReminderItem[];
  nextWeekItems: DashboardReminderItem[];
};

function resolveInitials(name: string) {
  const tokens = name.trim().split(/\s+/).filter(Boolean);

  if (tokens.length === 0) {
    return "?";
  }

  const first = tokens[0]?.[0] ?? "";
  const second = tokens[1]?.[0] ?? "";

  return `${first}${second}`.toUpperCase();
}

export function ReminderAppointmentsCard({
  language,
  nextDayItems,
  nextWeekItems,
}: ReminderAppointmentsCardProps) {
  const { t } = useTranslation("admin");
  const {
    activeTooltipKey,
    busyKey,
    sendReminder,
    showAlreadySentTooltip,
  } = useReminderAppointments({ language, t });

  function renderSection(
    title: string,
    emptyLabel: string,
    items: DashboardReminderItem[],
  ) {
    return (
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-[var(--admin-text-primary)]">
            {title}
          </h3>
          <span className="rounded-full bg-[var(--admin-inactive-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--admin-text-secondary)]">
            {items.length}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg bg-[var(--admin-inactive-bg)] px-3 py-3 text-xs font-medium text-[var(--admin-text-secondary)]">
            {emptyLabel}
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((item) => {
              const reminderKey = `${item.appointmentId}:${item.reminderType}`;
              const itemBusy = busyKey === reminderKey;
              const isDisabled = itemBusy || item.reminderSent;
              const actionTooltip = item.reminderSent
                ? t("dashboard.reminders.actions.alreadySentTooltip")
                : t("dashboard.reminders.actions.sendAriaLabel", {
                    name: item.name,
                  });
              const shouldShowTooltip =
                item.reminderSent && activeTooltipKey === reminderKey;

              return (
                <article
                  key={reminderKey}
                  className="flex items-center gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-3"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--admin-inactive-bg)] text-xs font-bold text-[var(--admin-accent)]">
                    {resolveInitials(item.name)}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-[var(--admin-text-primary)]">
                      {item.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-medium text-[var(--admin-text-secondary)]">
                      {`#${item.clientNumber}`}
                      {" ・ "}
                      {formatPhoneForDisplay(item.phone)}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-[var(--admin-accent)]">
                      {formatTimeSlotLabel(item.timeSlot, language)}
                    </p>
                  </div>

                  <span className="relative inline-flex">
                    <button
                      type="button"
                      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-accent)] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] ${isDisabled ? "cursor-not-allowed opacity-60" : "hover:bg-[var(--admin-inactive-bg)]"}`}
                      aria-label={actionTooltip}
                      aria-disabled={isDisabled}
                      onClick={() => {
                        if (item.reminderSent) {
                          showAlreadySentTooltip(reminderKey);
                          return;
                        }

                        if (!itemBusy) {
                          void sendReminder(item);
                        }
                      }}
                    >
                      <AdminIcon icon={adminIcons.sendReminder} />
                    </button>

                    {shouldShowTooltip ? (
                      <span
                        role="tooltip"
                        className="pointer-events-none absolute right-0 top-11 z-10 w-48 rounded-md bg-[var(--admin-text-primary)] px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
                      >
                        {actionTooltip}
                      </span>
                    ) : null}
                  </span>
                </article>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="mb-6">
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-[1rem] font-bold leading-[1.08] text-[var(--admin-text-primary)]">
            {t("dashboard.reminders.title")}
          </h2>
          <p className="text-xs font-medium text-[var(--admin-text-secondary)]">
            {t("dashboard.reminders.subtitle")}
          </p>
        </div>

        {renderSection(
          t("dashboard.reminders.nextDay.title"),
          t("dashboard.reminders.nextDay.empty"),
          nextDayItems,
        )}

        {renderSection(
          t("dashboard.reminders.nextWeek.title"),
          t("dashboard.reminders.nextWeek.empty"),
          nextWeekItems,
        )}
      </div>
    </div>
  );
}
