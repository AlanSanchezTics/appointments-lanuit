"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { BottomSheetModal } from "@/components/admin/ui/BottomSheetModal";
import { Button } from "@/components/admin/ui/Button";
import { adminIcons } from "@/components/admin/ui/admin-icons";
import { BLOCK_REASON_VALUES } from "@/lib/admin/blocked-spaces/types";
import { DIRECTIONAL_SLOT_PAIRS } from "@/lib/constants/slots";
import { formatTimeSlotLabel, parseDateOnly } from "@/lib/datetime/mexico-city";

type BlockReason = (typeof BLOCK_REASON_VALUES)[number];

type BlockSpacesModalProps = {
  isOpen: boolean;
  isLoadingDays: boolean;
  isSubmitting: boolean;
  isReadyToSubmit: boolean;
  errorCode: string | null;
  days: Array<{ date: string; slots: string[] }>;
  selectedDate: string | null;
  currentDate: string;
  selectedDaySlots: string[];
  selectedSlots: string[];
  areAllSelectedForDay: boolean;
  reason: BlockReason;
  allowBlockView: boolean;
  slotViewMode: "hour" | "block";
  onClose: () => void;
  onRetry: () => void;
  onSelectDate: (date: string) => void;
  onToggleSlot: (slot: string) => void;
  onToggleBlockSlots: (slots: string[]) => void;
  onSelectAllSlots: () => void;
  onClearSelectedSlots: () => void;
  onReasonChange: (reason: BlockReason) => void;
  onSlotViewModeChange: (mode: "hour" | "block") => void;
  onSubmit: () => void;
};

function resolveReasonIcon(reason: BlockReason) {
  if (reason === "DESCANSO") {
    return adminIcons.blockReasonRest;
  }

  if (reason === "PERSONAL") {
    return adminIcons.blockReasonPersonal;
  }

  return adminIcons.blockConfirm;
}

export function BlockSpacesModal({
  isOpen,
  isLoadingDays,
  isSubmitting,
  isReadyToSubmit,
  errorCode,
  days,
  selectedDate,
  currentDate,
  selectedDaySlots,
  selectedSlots,
  areAllSelectedForDay,
  reason,
  allowBlockView,
  slotViewMode,
  onClose,
  onRetry,
  onSelectDate,
  onToggleSlot,
  onToggleBlockSlots,
  onSelectAllSlots,
  onClearSelectedSlots,
  onReasonChange,
  onSlotViewModeChange,
  onSubmit,
}: BlockSpacesModalProps) {
  const { t, i18n } = useTranslation("admin");
  const locale = i18n.resolvedLanguage === "en" ? "en-US" : "es-MX";
  const effectiveSlotViewMode = allowBlockView ? slotViewMode : "hour";

  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: "America/Mexico_City",
        weekday: "short",
      }),
    [locale],
  );

  const dayNumberFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: "America/Mexico_City",
        day: "2-digit",
      }),
    [locale],
  );

  const availableBlocks = useMemo(
    () =>
      DIRECTIONAL_SLOT_PAIRS.map(([start, end]) => ({
        id: `${start}-${end}`,
        slots: [start, end] as string[],
        startSlot: start,
        endSlot: end,
      })).filter((block) =>
        block.slots.every((slot) => selectedDaySlots.includes(slot)),
      ),
    [selectedDaySlots],
  );

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      disableClose={isSubmitting}
      title={t("monthsDetail.blockModal.title")}
      closeLabel={t("monthsDetail.blockModal.close")}
    >
      <div className="space-y-7 pb-2">
        <section className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--admin-text-secondary)]">
            {t("monthsDetail.blockModal.daySection")}
          </h3>
          {isLoadingDays ? (
            <p className="rounded-xl bg-[var(--admin-inactive-bg)] p-4 text-sm text-[var(--admin-text-secondary)]">
              {t("monthsDetail.blockModal.loading")}
            </p>
          ) : null}

          {!isLoadingDays && errorCode ? (
            <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <p className="text-sm font-semibold text-[var(--admin-text-primary)]">
                {t("monthsDetail.errors.loadFailed")}
              </p>
              <p className="mt-1 text-xs text-[var(--admin-text-secondary)]">
                {errorCode}
              </p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onRetry}
                  disabled={isSubmitting}
                >
                  {t("monthsDetail.errors.retry")}
                </Button>
              </div>
            </div>
          ) : null}

          {!isLoadingDays && !errorCode && days.length === 0 ? (
            <p className="rounded-xl bg-[var(--admin-inactive-bg)] p-4 text-sm text-[var(--admin-text-secondary)]">
              {t("monthsDetail.blockModal.emptyDays")}
            </p>
          ) : null}

          {!isLoadingDays && !errorCode && days.length > 0 ? (
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
              {days.map((day) => {
                const isSelected = selectedDate === day.date;
                const dateValue = parseDateOnly(day.date);
                const weekday = dayFormatter.format(dateValue);
                const dayNumber = dayNumberFormatter.format(dateValue);
                const isToday = day.date === currentDate;

                return (
                  <button
                    type="button"
                    key={day.date}
                    onClick={() => onSelectDate(day.date)}
                    disabled={isSubmitting}
                    className={`flex h-[88px] min-w-[72px] flex-col items-center justify-center rounded-2xl px-3 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] ${
                      isSelected
                        ? "bg-[var(--admin-primary)] text-white shadow-sm"
                        : "bg-[var(--admin-inactive-bg)] text-[var(--admin-text-primary)]"
                    }`}
                  >
                    <span
                      className={`text-[12px] font-semibold ${isSelected ? "text-white/90" : "text-[var(--admin-text-secondary)]"}`}
                    >
                      {isToday ? t("monthsDetail.blockModal.today") : weekday}
                    </span>
                    <span className="text-[34px] font-extrabold leading-[1.05] tracking-[-0.04em]">
                      {dayNumber}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          {allowBlockView ? (
            <div className="inline-flex w-full rounded-full bg-[var(--admin-inactive-bg)] p-1">
              <button
                type="button"
                onClick={() => onSlotViewModeChange("hour")}
                disabled={isSubmitting}
                aria-pressed={effectiveSlotViewMode === "hour"}
                className={`inline-flex min-h-9 flex-1 items-center justify-center rounded-full px-4 text-center text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] ${
                  effectiveSlotViewMode === "hour"
                    ? "bg-[var(--admin-surface)] text-[var(--admin-text-primary)] shadow-sm"
                    : "text-[var(--admin-text-secondary)]"
                }`}
              >
                {t("monthsDetail.blockModal.viewModes.hour")}
              </button>
              <button
                type="button"
                onClick={() => onSlotViewModeChange("block")}
                disabled={isSubmitting}
                aria-pressed={effectiveSlotViewMode === "block"}
                className={`inline-flex min-h-9 flex-1 items-center justify-center rounded-full px-4 text-center text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] ${
                  effectiveSlotViewMode === "block"
                    ? "bg-[var(--admin-surface)] text-[var(--admin-text-primary)] shadow-sm"
                    : "text-[var(--admin-text-secondary)]"
                }`}
              >
                {t("monthsDetail.blockModal.viewModes.block")}
              </button>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--admin-text-secondary)]">
              {t("monthsDetail.blockModal.slotSection")}
            </h3>
            <button
              type="button"
              onClick={
                areAllSelectedForDay ? onClearSelectedSlots : onSelectAllSlots
              }
              disabled={isSubmitting || selectedDaySlots.length === 0}
              aria-pressed={areAllSelectedForDay}
              className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-[13px] font-semibold text-[var(--admin-accent)] transition hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <span>{t("monthsDetail.blockModal.actions.selectAll")}</span>
              <span
                className={`inline-flex h-4 w-4 items-center justify-center rounded-[3px] border text-[10px] leading-none ${areAllSelectedForDay ? "border-[var(--admin-accent)] bg-[var(--admin-accent)] text-white" : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-transparent"}`}
                aria-hidden
              >
                ✓
              </span>
            </button>
          </div>
          {selectedDate && selectedDaySlots.length > 0 ? (
            effectiveSlotViewMode === "hour" ? (
              <div className="space-y-3">
                {selectedDaySlots.map((slot) => {
                  const isSelected = selectedSlots.includes(slot);

                  return (
                    <button
                      type="button"
                      key={slot}
                      onClick={() => onToggleSlot(slot)}
                      disabled={isSubmitting}
                      className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] ${
                        isSelected
                          ? "border-transparent bg-[var(--admin-primary)] text-white"
                          : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-primary)]"
                      }`}
                    >
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${
                          isSelected
                            ? "bg-white/20"
                            : "bg-[var(--admin-inactive-bg)]"
                        }`}
                      >
                        <AdminIcon
                          icon={adminIcons.blockSchedule}
                          tone={isSelected ? "primary" : "secondary"}
                          className={isSelected ? "text-white" : null}
                        />
                      </span>
                      <span
                        className={`text-lg font-bold tracking-[-0.02em] ${isSelected ? "text-white" : "text-[var(--admin-text-primary)]"}`}
                      >
                        {formatTimeSlotLabel(
                          slot,
                          i18n.resolvedLanguage === "en" ? "en" : "es",
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : availableBlocks.length > 0 ? (
              <div className="space-y-3">
                {availableBlocks.map((block) => {
                  const isSelected = block.slots.every((slot) =>
                    selectedSlots.includes(slot),
                  );

                  return (
                    <button
                      type="button"
                      key={block.id}
                      onClick={() => onToggleBlockSlots(block.slots)}
                      disabled={isSubmitting}
                      className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] ${
                        isSelected
                          ? "border-transparent bg-[var(--admin-primary)] text-white"
                          : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-primary)]"
                      }`}
                    >
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${
                          isSelected
                            ? "bg-white/20"
                            : "bg-[var(--admin-inactive-bg)]"
                        }`}
                      >
                        <AdminIcon
                          icon={adminIcons.blockSchedule}
                          tone={isSelected ? "primary" : "secondary"}
                          className={isSelected ? "text-white" : null}
                        />
                      </span>
                      <span
                        className={`text-lg font-bold tracking-[-0.02em] ${isSelected ? "text-white" : "text-[var(--admin-text-primary)]"}`}
                      >
                        {formatTimeSlotLabel(
                          block.startSlot,
                          i18n.resolvedLanguage === "en" ? "en" : "es",
                        )}{" "}
                        -{" "}
                        {formatTimeSlotLabel(
                          block.endSlot,
                          i18n.resolvedLanguage === "en" ? "en" : "es",
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-xl bg-[var(--admin-inactive-bg)] p-4 text-sm text-[var(--admin-text-secondary)]">
                {t("monthsDetail.blockModal.emptyBlocks")}
              </p>
            )
          ) : (
            <p className="rounded-xl bg-[var(--admin-inactive-bg)] p-4 text-sm text-[var(--admin-text-secondary)]">
              {t("monthsDetail.blockModal.emptySlots")}
            </p>
          )}
        </section>

        <section className="space-y-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--admin-text-secondary)]">
            {t("monthsDetail.blockModal.reasonSection")}
          </h3>

          <div className="flex gap-2 overflow-x-auto scroll-smooth no-scrollbar">
            {BLOCK_REASON_VALUES.map((option) => {
              const isActive = reason === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => onReasonChange(option)}
                  disabled={isSubmitting}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] ${
                    isActive
                      ? "bg-[var(--admin-success-bg)] text-[var(--admin-success-text)]"
                      : "bg-[var(--admin-inactive-bg)] text-[var(--admin-text-primary)]"
                  }`}
                >
                  <AdminIcon
                    icon={resolveReasonIcon(option)}
                    tone="secondary"
                  />
                  {t(`monthsDetail.blockModal.reasons.${option}`)}
                </button>
              );
            })}
          </div>
        </section>

        <div className="space-y-3">
          <Button
            type="button"
            fullWidth
            disabled={!isReadyToSubmit}
            onClick={onSubmit}
            className="h-14 gap-3 rounded-full bg-[var(--admin-primary)] text-white hover:brightness-95"
          >
            {isSubmitting ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            ) : null}
            {t("monthsDetail.blockModal.confirm")}
          </Button>
          <p className="text-center text-xs text-[var(--admin-text-secondary)]">
            {t("monthsDetail.blockModal.helper")}
          </p>
        </div>
      </div>
    </BottomSheetModal>
  );
}
