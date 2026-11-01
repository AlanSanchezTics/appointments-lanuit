"use client";

import { useTranslation } from "react-i18next";

import { Button } from "@/components/admin/ui/Button";
import { Modal } from "@/components/admin/ui/Modal";
import type { AffectedAppointmentItem } from "@/lib/admin/months/types";
import { formatTimeSlotLabel, parseDateOnly } from "@/lib/datetime/mexico-city";

type AffectedAppointmentsDialogProps = {
  isOpen: boolean;
  items: AffectedAppointmentItem[];
  isBusy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const KNOWN_STATUSES = ["PENDING", "CONFIRMED", "SYNC_FAILED"] as const;

// Confirmación de D18/D40: lista las citas activas que quedarían fuera del horario. No es sileo: exige una decisión.
// Cancelar solo cierra el diálogo; confirmar lo resuelve el contenedor con confirmAffectedAppointments.
export function AffectedAppointmentsDialog({
  isOpen,
  items,
  isBusy,
  onConfirm,
  onCancel,
}: AffectedAppointmentsDialogProps) {
  const { t, i18n } = useTranslation("admin");
  const isEnglish = i18n.resolvedLanguage === "en";
  const dateFormatter = new Intl.DateTimeFormat(isEnglish ? "en-US" : "es-MX", {
    timeZone: "America/Mexico_City",
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  function resolveStatusLabel(status: string) {
    const isKnown = (KNOWN_STATUSES as readonly string[]).includes(status);

    return t(
      isKnown
        ? `monthsDetail.availability.affected.statuses.${status}`
        : "monthsDetail.availability.affected.statuses.unknown",
    );
  }

  return (
    <Modal
      isOpen={isOpen}
      title={t("monthsDetail.availability.affected.title")}
      closeLabel={t("monthsDetail.availability.close")}
      onClose={isBusy ? () => undefined : onCancel}
    >
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-[var(--admin-text-secondary)]">
          {t("monthsDetail.availability.affected.description", { total: items.length })}
        </p>

        <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto">
          {items.map((item) => (
            <li
              key={item.appointmentId}
              className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2"
            >
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                <dt className="font-semibold text-[var(--admin-text-secondary)]">
                  {t("monthsDetail.availability.affected.fields.date")}
                </dt>
                <dd className="text-[var(--admin-text-primary)]">
                  {dateFormatter.format(parseDateOnly(item.date))}
                </dd>
                <dt className="font-semibold text-[var(--admin-text-secondary)]">
                  {t("monthsDetail.availability.affected.fields.time")}
                </dt>
                <dd className="text-[var(--admin-text-primary)]">
                  {formatTimeSlotLabel(item.timeSlot.slice(0, 5), isEnglish ? "en" : "es")}
                </dd>
                <dt className="font-semibold text-[var(--admin-text-secondary)]">
                  {t("monthsDetail.availability.affected.fields.status")}
                </dt>
                <dd className="text-[var(--admin-text-primary)]">{resolveStatusLabel(item.status)}</dd>
                <dt className="font-semibold text-[var(--admin-text-secondary)]">
                  {t("monthsDetail.availability.affected.fields.client")}
                </dt>
                <dd className="text-[var(--admin-text-primary)]">{item.clientName}</dd>
              </dl>
            </li>
          ))}
        </ul>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={isBusy} onClick={onCancel}>
            {t("monthsDetail.availability.affected.cancel")}
          </Button>
          <Button type="button" disabled={isBusy} onClick={onConfirm}>
            {t("monthsDetail.availability.affected.confirm")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
