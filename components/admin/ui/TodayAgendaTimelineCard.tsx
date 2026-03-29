import { formatPhoneForDisplay } from "@/lib/booking/formatters";
import { formatTimeSlotLabel } from "@/lib/datetime/mexico-city";
import type { TodayAgendaItem } from "@/lib/admin/dashboard/types";
import type { AppLanguage } from "@/lib/i18n/config";
import Link from "next/link";

import { AdminIcon } from "./AdminIcon";
import { adminIcons } from "./admin-icons";

interface TodayAgendaTimelineCardProps {
  language: AppLanguage;
  title: string;
  emptyLabel: string;
  readyLabel: string;
  inProgressLabel: string;
  pendingLabel: string;
  items: TodayAgendaItem[];
  monthHref: string;
  monthLinkAriaLabel: string;
}

function getStatusMeta(
  status: TodayAgendaItem["status"],
  labels: {
    readyLabel: string;
    inProgressLabel: string;
    pendingLabel: string;
  },
) {
  if (status === "READY") {
    return {
      label: labels.readyLabel,
      tagClassName:
        "bg-[var(--admin-success-bg)] text-[var(--admin-success-text)]",
      rowClassName: "border-transparent",
      icon: adminIcons.monthDetailConfirmed,
      iconClassName: "text-[var(--admin-success-text)]",
      blink: false,
    };
  }

  if (status === "IN_PROGRESS") {
    return {
      label: labels.inProgressLabel,
      tagClassName: "bg-[rgba(228,159,83,0.22)] text-[var(--admin-accent)]",
      rowClassName:
        "border-l-[3px] border-l-[var(--admin-accent)] border-t-0 border-b-0 border-r-0",
      icon: null,
      iconClassName: "",
      blink: true,
    };
  }

  return {
    label: labels.pendingLabel,
    tagClassName:
      "bg-[var(--admin-inactive-bg)] text-[var(--admin-text-secondary)]/80",
    rowClassName: "border-transparent opacity-60",
    icon: null,
    iconClassName: "",
    blink: false,
  };
}

function splitTimeLabel(value: string) {
  const [hour, meridiem] = value.split(" ");
  return {
    hour: hour ?? "--:--",
    meridiem: meridiem ?? "",
  };
}

export function TodayAgendaTimelineCard({
  language,
  title,
  emptyLabel,
  readyLabel,
  inProgressLabel,
  pendingLabel,
  items,
  monthHref,
  monthLinkAriaLabel,
}: TodayAgendaTimelineCardProps) {
  return (
    <div className="mb-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[1rem] font-bold leading-[1.08] text-[var(--admin-text-primary)]">
          {title}
        </h2>
        <Link
          href={monthHref}
          aria-label={monthLinkAriaLabel}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-accent)] transition hover:bg-[var(--admin-inactive-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)]"
        >
          <AdminIcon icon={adminIcons.redirectLink} className="text-[13px]" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl bg-[var(--admin-inactive-bg)] p-4 text-sm text-[var(--admin-text-secondary)]">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const statusMeta = getStatusMeta(item.status, {
              readyLabel,
              inProgressLabel,
              pendingLabel,
            });
            const time = splitTimeLabel(
              formatTimeSlotLabel(item.timeSlot, language),
            );

            return (
              <article
                key={item.appointmentId}
                className={`flex items-center gap-4 rounded-xl border bg-[var(--admin-surface)] px-4 py-3 shadow-sm ${statusMeta.rowClassName}`}
              >
                <div className="w-[56px] shrink-0 text-center">
                  <p className="text-[14px] font-bold leading-none text-[var(--admin-text-primary)]">
                    {time.hour}
                  </p>
                  <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-text-secondary)]">
                    {time.meridiem}
                  </p>
                </div>

                <div className="h-10 w-px shrink-0 bg-[var(--admin-border)]" />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold leading-[1.08] text-[var(--admin-text-primary)]">
                    {item.name}
                  </p>
                  <p className="mt-1 text-[12px] font-medium text-[var(--admin-text-secondary)]">
                    {formatPhoneForDisplay(item.phone)}
                  </p>
                </div>

                <span
                  className={`inline-flex min-h-8 shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold tracking-[0.03em] ${statusMeta.tagClassName} ${statusMeta.blink ? "admin-status-blink" : ""}`}
                >
                  {statusMeta.icon ? (
                    <AdminIcon
                      icon={statusMeta.icon}
                      className={statusMeta.iconClassName}
                      size="sm"
                    />
                  ) : null}
                  {statusMeta.label}
                </span>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
