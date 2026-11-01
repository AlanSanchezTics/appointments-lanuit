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
  type EditorRule,
} from "@/hooks/admin/months/useAvailabilityEditor";
import type { AvailabilityRuleBody } from "@/lib/admin/months/types";

// ISO 1 = lunes, 7 = domingo (A-10).
const ISO_WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

type AvailabilityRuleFormProps = {
  month: string;
  rule: EditorRule;
  errorCode: string | null;
  disabled: boolean;
  onChange: (patch: Partial<AvailabilityRuleBody>) => void;
  onRemove: () => void;
};

export function AvailabilityRuleForm({
  month,
  rule,
  errorCode,
  disabled,
  onChange,
  onRemove,
}: AvailabilityRuleFormProps) {
  const { t } = useTranslation("admin");
  const bounds = getMonthDateBounds(month);

  function toggleWeekday(weekday: number) {
    const nextWeekdays = rule.weekdays.includes(weekday)
      ? rule.weekdays.filter((value) => value !== weekday)
      : [...rule.weekdays, weekday].sort((first, second) => first - second);

    onChange({ weekdays: nextWeekdays });
  }

  return (
    <Card className="flex min-w-0 flex-col gap-6">
      <div className="flex min-w-0 flex-col gap-6">
        <Input
          id={`${rule.key}-start-date`}
          label={t("monthsDetail.availability.fields.startDate")}
          type="date"
          className="min-w-0 max-w-full"
          min={bounds.first}
          max={bounds.last}
          value={rule.startDate}
          disabled={disabled}
          onChange={(event) => onChange({ startDate: event.target.value })}
        />
        <Input
          id={`${rule.key}-end-date`}
          label={t("monthsDetail.availability.fields.endDate")}
          type="date"
          className="min-w-0 max-w-full"
          min={bounds.first}
          max={bounds.last}
          value={rule.endDate}
          disabled={disabled}
          onChange={(event) => onChange({ endDate: event.target.value })}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--admin-text-secondary)]">
          {t("monthsDetail.availability.fields.weekdays")}
        </legend>
        <div className="flex flex-wrap gap-2">
          {ISO_WEEKDAYS.map((weekday) => {
            const isSelected = rule.weekdays.includes(weekday);

            return (
              <Button
                key={weekday}
                type="button"
                size="sm"
                variant={isSelected ? "primary" : "secondary"}
                aria-pressed={isSelected}
                disabled={disabled}
                onClick={() => toggleWeekday(weekday)}
              >
                {t(`monthsDetail.availability.weekdays.${weekday}`)}
              </Button>
            );
          })}
        </div>
      </fieldset>

      <TimeSlotChipInput
        id={`${rule.key}-times`}
        label={t("monthsDetail.availability.fields.times")}
        values={rule.times}
        onChange={(times) => onChange({ times })}
        addLabel={t("monthsDetail.availability.fields.addTime")}
        removeLabel={t("monthsDetail.availability.fields.removeTime")}
        disabled={disabled}
      />

      <AvailabilityParamsFields
        idPrefix={rule.key}
        minGapMinutes={rule.minGapMinutes}
        preserveCapacity={rule.preserveCapacity}
        maxPerDay={rule.maxPerDay}
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
