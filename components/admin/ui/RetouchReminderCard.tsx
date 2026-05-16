"use client";

import { useTranslation } from "react-i18next";

import { formatPhoneForDisplay } from "@/lib/booking/formatters";
import type { RetouchReminderItem } from "@/lib/admin/dashboard/types";
import { useRetouchReminders } from "@/hooks/admin/useRetouchReminders";

import { AdminIcon } from "./AdminIcon";
import { adminIcons } from "./admin-icons";

type RetouchReminderCardProps = {
  items: RetouchReminderItem[];
};

function resolveDayAndMonth(date: string, locale: string) {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const day = new Intl.DateTimeFormat(locale, {
    timeZone: "America/Mexico_City",
    day: "numeric",
  }).format(parsed);
  const month = new Intl.DateTimeFormat(locale, {
    timeZone: "America/Mexico_City",
    month: "long",
  }).format(parsed);

  return {
    day,
    month,
  };
}

function resolveInitials(name: string) {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return "?";
  }

  const first = tokens[0]?.[0] ?? "";
  const second = tokens[1]?.[0] ?? "";
  return `${first}${second}`.toUpperCase();
}

export function RetouchReminderCard({ items }: RetouchReminderCardProps) {
  const { t, i18n } = useTranslation("admin");
  const { sendRetouchReminder } = useRetouchReminders({ t });

  return (
    <div className="mb-6">
      <div className="space-y-4">
        <div className="space-y-1">
          <h2 className="text-[1rem] font-bold leading-[1.08] text-[var(--admin-text-primary)]">
            {t("dashboard.retouchReminders.title")}
          </h2>
          <p className="text-xs font-medium text-[var(--admin-text-secondary)]">
            {t("dashboard.retouchReminders.subtitle")}
          </p>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-[var(--admin-text-primary)]">
              {t("dashboard.retouchReminders.candidates.title")}
            </h3>
            <span className="rounded-full bg-[var(--admin-inactive-bg)] px-2.5 py-1 text-[11px] font-semibold text-[var(--admin-text-secondary)]">
              {items.length}
            </span>
          </div>

          <div className="space-y-2.5">
            {items.map((item) => {
              const locale = i18n.language === "en" ? "en-US" : "es-MX";
              const { day, month } = resolveDayAndMonth(
                item.lastAppointmentDate,
                locale,
              );

              return (
                <article
                  key={item.clientId}
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
                      {item.alias ? ` ・ ${item.alias}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-[var(--admin-accent)]">
                      {t("dashboard.retouchReminders.lastAppointmentLabel", {
                        day,
                        month,
                      })}
                    </p>
                  </div>

                  <button
                    type="button"
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-accent)] transition hover:bg-[var(--admin-inactive-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)]"
                    aria-label={t(
                      "dashboard.retouchReminders.actions.sendAriaLabel",
                      {
                        name: item.name,
                      },
                    )}
                    onClick={() => {
                      sendRetouchReminder(item);
                    }}
                  >
                    <AdminIcon icon={adminIcons.sendReminder} />
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
