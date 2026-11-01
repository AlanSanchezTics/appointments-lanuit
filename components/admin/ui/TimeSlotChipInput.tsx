"use client";

import { faPlus } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useState, type KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";

import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { adminIcons } from "@/components/admin/ui/admin-icons";
import { Button } from "@/components/admin/ui/Button";
import { Input } from "@/components/admin/ui/Input";

export interface TimeSlotChipInputProps {
  id: string;
  label: string;
  // Valores internos en HH:mm (24 h). Lo que ve el usuario en los chips es en 12 h con AM/PM.
  values: string[];
  onChange: (values: string[]) => void;
  addLabel: string;
  // Prefijo del aria-label de cada chip: "<removeLabel> 9:00 AM".
  removeLabel: string;
  emptyLabel?: string;
  error?: string | null;
  disabled?: boolean;
}

// Un único input nativo type="time": el valor es siempre HH:mm (24 h). El formato que ve el usuario en el control
// (12 o 24 h) lo decide el dispositivo y el idioma; no es configurable desde la app.
// Mantiene orden ascendente por valor 24 h y sin repetidos. Las reglas (00:00, límite) las valida el motor.
export function TimeSlotChipInput({
  id,
  label,
  values,
  onChange,
  addLabel,
  removeLabel,
  emptyLabel,
  error,
  disabled = false,
}: TimeSlotChipInputProps) {
  const { t } = useTranslation("admin");
  const [draft, setDraft] = useState("");
  const periodLabels = {
    AM: t("monthsDetail.availability.periods.am"),
    PM: t("monthsDetail.availability.periods.pm"),
  };

  // Chips en 12 h: "9:00 AM". Solo presentación; el valor interno no cambia.
  function formatTime(time: string) {
    const [hours, minutes] = time.split(":");
    const hour24 = Number(hours);
    const hour12 = hour24 % 12 || 12;

    return `${hour12}:${minutes} ${hour24 < 12 ? periodLabels.AM : periodLabels.PM}`;
  }

  function addDraft() {
    if (disabled || draft === "") {
      return;
    }

    if (!values.includes(draft)) {
      onChange([...values, draft].sort());
    }

    setDraft("");
  }

  function removeValue(time: string) {
    onChange(values.filter((value) => value !== time));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      addDraft();
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Input
            id={id}
            label={label}
            type="time"
            value={draft}
            disabled={disabled}
            className="min-w-0 max-w-full"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          className="h-14 w-14 shrink-0"
          aria-label={addLabel}
          disabled={disabled || draft === ""}
          onClick={addDraft}
        >
          <FontAwesomeIcon icon={faPlus} />
        </Button>
      </div>

      {values.length > 0 ? (
        <ul className="grid grid-cols-3 gap-2">
          {values.map((time) => {
            const text = formatTime(time);

            return (
              <li
                key={time}
                className="flex min-w-0 items-center justify-between gap-1 rounded-full border border-[var(--admin-border)] bg-[var(--admin-inactive-bg)] py-1 pl-2 pr-1 text-xs font-semibold text-[var(--admin-text-primary)]"
              >
                <span className="min-w-0 truncate">{text}</span>
                <button
                  type="button"
                  aria-label={`${removeLabel} ${text}`}
                  disabled={disabled}
                  onClick={() => removeValue(time)}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition hover:bg-[var(--admin-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <AdminIcon icon={adminIcons.close} tone="secondary" size="xs" />
                </button>
              </li>
            );
          })}
        </ul>
      ) : emptyLabel ? (
        <p className="text-xs font-medium text-[var(--admin-text-secondary)]">{emptyLabel}</p>
      ) : null}

      {error ? (
        <p className="text-xs font-medium text-[var(--error)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
