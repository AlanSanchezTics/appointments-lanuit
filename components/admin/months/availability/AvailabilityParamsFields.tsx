"use client";

import { useTranslation } from "react-i18next";

import { Input } from "@/components/admin/ui/Input";
import { Select } from "@/components/admin/ui/Select";
import { Switch } from "@/components/admin/ui/Switch";
import { Tooltip } from "@/components/admin/ui/Tooltip";
import type { AvailabilityRuleBody } from "@/lib/admin/months/types";

export type AvailabilityParamsPatch = Partial<
  Pick<AvailabilityRuleBody, "minGapMinutes" | "preserveCapacity" | "maxPerDay">
>;

type AvailabilityParamsFieldsProps = {
  idPrefix: string;
  minGapMinutes: number;
  preserveCapacity: boolean;
  maxPerDay: number;
  disabled: boolean;
  onChange: (patch: AvailabilityParamsPatch) => void;
};

const MAX_PER_DAY_OPTIONS = [1, 2, 3, 4, 5, 6].map((value) => ({
  label: String(value),
  value: String(value),
}));

// Campos comunes de reglas y excepciones (FR-003, D20, D21). Compartidos para no duplicar la UI.
export function AvailabilityParamsFields({
  idPrefix,
  minGapMinutes,
  preserveCapacity,
  maxPerDay,
  disabled,
  onChange,
}: AvailabilityParamsFieldsProps) {
  const { t } = useTranslation("admin");

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Input
        id={`${idPrefix}-min-gap`}
        label={t("monthsDetail.availability.fields.minGap")}
        type="number"
        inputMode="numeric"
        min={0}
        max={1440}
        step={1}
        disabled={disabled}
        // NaN = campo vacío; el motor lo rechaza con AVAILABILITY_MIN_GAP_OUT_OF_RANGE.
        value={Number.isNaN(minGapMinutes) ? "" : String(minGapMinutes)}
        onChange={(event) =>
          onChange({
            minGapMinutes: event.target.value === "" ? Number.NaN : Number(event.target.value),
          })
        }
      />
      <Select
        id={`${idPrefix}-max-per-day`}
        label={t("monthsDetail.availability.fields.maxPerDay")}
        value={String(maxPerDay)}
        options={MAX_PER_DAY_OPTIONS}
        showPlaceholder={false}
        disabled={disabled}
        onChange={(value) => onChange({ maxPerDay: Number(value) })}
      />
      <Switch
        id={`${idPrefix}-preserve-capacity`}
        label={t("monthsDetail.availability.fields.preserveCapacity")}
        checked={preserveCapacity}
        disabled={disabled}
        onChange={(checked) => onChange({ preserveCapacity: checked })}
        labelAdornment={
          <Tooltip
            label={t("monthsDetail.availability.fields.preserveCapacityHelpLabel")}
            align="center"
          >
            {t("monthsDetail.availability.fields.preserveCapacityHelp")}
          </Tooltip>
        }
      />
    </div>
  );
}
