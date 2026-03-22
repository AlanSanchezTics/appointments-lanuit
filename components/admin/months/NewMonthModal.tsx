"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/admin/ui/Button";
import { Modal } from "@/components/admin/ui/Modal";
import { Select, type SelectOption } from "@/components/admin/ui/Select";
import { fetchMonthsCatalog } from "@/lib/admin/months/api-client";
import {
  formatShortMonthLabel,
  getFutureMonthsForYear,
} from "@/lib/admin/months/month-helpers";
import type { AppLanguage } from "@/lib/i18n/config";

type NewMonthModalProps = {
  isOpen: boolean;
  availableYears: number[];
  currentMonth: string;
  language: AppLanguage;
  onClose: () => void;
  onSave: (input: { year: number; months: string[] }) => Promise<void>;
};

export function NewMonthModal({
  isOpen,
  availableYears,
  currentMonth,
  language,
  onClose,
  onSave,
}: NewMonthModalProps) {
  const { t } = useTranslation("admin");
  const [selectedYear, setSelectedYear] = useState<number>(availableYears[0]);
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingYearMonths, setIsLoadingYearMonths] = useState(false);
  const [existingMonthsForYear, setExistingMonthsForYear] = useState<string[]>([]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setSelectedYear(availableYears[0]);
    setSelectedMonths([]);
    setIsSubmitting(false);
    setExistingMonthsForYear([]);
    setIsLoadingYearMonths(false);
  }, [availableYears, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    let isMounted = true;
    setIsLoadingYearMonths(true);

    void fetchMonthsCatalog({
      year: selectedYear,
      status: "ALL",
    })
      .then((response) => {
        if (!isMounted) {
          return;
        }

        setExistingMonthsForYear(response.months.map((month) => month.month));
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }
        setExistingMonthsForYear([]);
      })
      .finally(() => {
        if (!isMounted) {
          return;
        }
        setIsLoadingYearMonths(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, selectedYear]);

  const yearOptions = useMemo<SelectOption[]>(
    () =>
      availableYears.map((year) => ({
        value: String(year),
        label: String(year),
      })),
    [availableYears],
  );

  const availableMonths = useMemo(
    () =>
      getFutureMonthsForYear(selectedYear, currentMonth).filter(
        (month) => !existingMonthsForYear.includes(month),
      ),
    [currentMonth, existingMonthsForYear, selectedYear],
  );

  function toggleMonth(month: string) {
    setSelectedMonths((current) =>
      current.includes(month)
        ? current.filter((value) => value !== month)
        : [...current, month].sort(),
    );
  }

  async function handleSave() {
    if (selectedMonths.length === 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      await onSave({
        year: selectedYear,
        months: selectedMonths,
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      title={t("monthsCatalog.newModal.title")}
      closeLabel={t("monthsCatalog.newModal.close")}
      onClose={onClose}
    >
      <div className="space-y-4">
        <div className="space-y-1">
          <label
            htmlFor="new-month-modal-year"
            className="text-[10px] font-bold uppercase text-[var(--admin-text-secondary)]"
          >
            {t("monthsCatalog.newModal.year")}
          </label>
          <Select
            id="new-month-modal-year"
            value={String(selectedYear)}
            options={yearOptions}
            onChange={(value) => {
              setSelectedYear(Number(value));
              setSelectedMonths([]);
            }}
            showPlaceholder={false}
            disabled={isSubmitting || isLoadingYearMonths}
          />
        </div>

        {isLoadingYearMonths ? (
          <p className="rounded-xl bg-[var(--admin-inactive-bg)] p-3 text-sm text-[var(--admin-text-secondary)]">
            {t("monthsCatalog.newModal.loadingMonths")}
          </p>
        ) : availableMonths.length > 0 ? (
          <div className="grid grid-cols-3 gap-3">
            {availableMonths.map((month) => {
              const isSelected = selectedMonths.includes(month);
              return (
                <button
                  key={month}
                  type="button"
                  onClick={() => toggleMonth(month)}
                  className={`min-h-11 rounded-xl border px-2 py-3 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] ${
                    isSelected
                      ? "border-[var(--admin-primary)] bg-[var(--admin-primary)] text-white"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-primary)] hover:bg-[var(--admin-inactive-bg)]"
                  }`}
                  aria-pressed={isSelected}
                >
                  {formatShortMonthLabel(month, language)}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="rounded-xl bg-[var(--admin-inactive-bg)] p-3 text-sm text-[var(--admin-text-secondary)]">
            {t("monthsCatalog.newModal.noFutureMonths")}
          </p>
        )}

        <Button
          type="button"
          fullWidth
          onClick={handleSave}
          disabled={isSubmitting || isLoadingYearMonths || selectedMonths.length === 0}
        >
          {t("monthsCatalog.newModal.save")}
        </Button>
      </div>
    </Modal>
  );
}
