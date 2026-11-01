"use client";

import { useTranslation } from "react-i18next";

import { Button } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Card";
import { Input } from "@/components/admin/ui/Input";
import { TimeSlotChipInput } from "@/components/admin/ui/TimeSlotChipInput";
import { AvailabilityParamsFields } from "@/components/admin/months/availability/AvailabilityParamsFields";
import {
  getMonthDateBounds,
  resolveAvailabilityErrorKey,
  type EditorException,
} from "@/hooks/admin/months/useAvailabilityEditor";
import type { AvailabilityExceptionBody } from "@/lib/admin/months/types";

type AvailabilityExceptionFormProps = {
  month: string;
  exception: EditorException;
  errorCode: string | null;
  disabled: boolean;
  onChange: (patch: Partial<AvailabilityExceptionBody>) => void;
  onRemove: () => void;
};

export function AvailabilityExceptionForm({
  month,
  exception,
  errorCode,
  disabled,
  onChange,
  onRemove,
}: AvailabilityExceptionFormProps) {
  const { t } = useTranslation("admin");
  const bounds = getMonthDateBounds(month);
  // A2: horas vacías = día cerrado. Se avisa para que no sea un cierre accidental.
  const isClosedDay = exception.times.length === 0;

  return (
    <Card className="flex min-w-0 flex-col gap-6">
      <Input
        id={`${exception.key}-date`}
        label={t("monthsDetail.availability.fields.date")}
        type="date"
        className="min-w-0 max-w-full"
        min={bounds.first}
        max={bounds.last}
        value={exception.date}
        disabled={disabled}
        onChange={(event) => onChange({ date: event.target.value })}
      />

      <TimeSlotChipInput
        id={`${exception.key}-times`}
        label={t("monthsDetail.availability.fields.times")}
        values={exception.times}
        onChange={(times) => onChange({ times })}
        addLabel={t("monthsDetail.availability.fields.addTime")}
        removeLabel={t("monthsDetail.availability.fields.removeTime")}
        disabled={disabled}
      />

      {isClosedDay ? (
        <p
          className="rounded-lg bg-[var(--admin-inactive-bg)] p-3 text-xs font-semibold text-[var(--admin-text-primary)]"
          role="status"
        >
          {t("monthsDetail.availability.closedDayNotice")}
        </p>
      ) : null}

      <AvailabilityParamsFields
        idPrefix={exception.key}
        minGapMinutes={exception.minGapMinutes}
        preserveCapacity={exception.preserveCapacity}
        maxPerDay={exception.maxPerDay}
        disabled={disabled}
        onChange={onChange}
      />

      {errorCode ? (
        <p className="text-xs font-medium text-[var(--error)]" role="alert">
          {t(resolveAvailabilityErrorKey(errorCode))}
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={onRemove}>
          {t("monthsDetail.availability.removeItem")}
        </Button>
      </div>
    </Card>
  );
}
