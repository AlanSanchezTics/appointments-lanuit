"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";

import { BlockSpacesModal } from "@/components/admin/months/BlockSpacesModal";
import type { AdminDayAgendaItem } from "@/lib/admin/appointments/types";
import {
  cancelAdminAppointmentById,
  fetchAdminDayAgenda,
  rescheduleAdminAppointmentById,
} from "@/lib/admin/appointments/api-client";
import { updateAdminMonthSlotMode } from "@/lib/admin/months/api-client";
import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { BottomSheetModal } from "@/components/admin/ui/BottomSheetModal";
import { Button } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Card";
import { Select, type SelectOption } from "@/components/admin/ui/Select";
import { adminIcons } from "@/components/admin/ui/admin-icons";
import { useBlockSpacesModal } from "@/hooks/admin/months/useBlockSpacesModal";
import { BASE_TIME_SLOTS } from "@/lib/constants/slots";
import { useDayAgendaModal } from "@/hooks/admin/months/useDayAgendaModal";
import { useMonthDetail } from "@/hooks/admin/months/useMonthDetail";
import { resolveBaseSlotsByMonthMode } from "@/lib/availability/month-slot-mode";
import {
  formatMonthLabel,
  formatTimeSlotLabel,
  isFutureDateTime,
  parseDateOnly,
} from "@/lib/datetime/mexico-city";
import { getAvailableStartSlots } from "@/lib/availability/rules";
import type { AppLanguage } from "@/lib/i18n/config";
import type {
  MonthSlotMode,
  MonthDetailCalendarDay,
  MonthDetailResponse,
} from "@/lib/admin/months/types";

type MonthDetailViewProps = {
  month: string;
  initialData: MonthDetailResponse;
};

const weekdayOrder = [0, 1, 2, 3, 4, 5, 6];

function resolveAppLanguage(language: string): AppLanguage {
  return language === "en" ? "en" : "es";
}

function resolveLocale(language: AppLanguage) {
  return language === "en" ? "en-US" : "es-MX";
}

function getToneClasses(tone: MonthDetailCalendarDay["tone"]) {
  switch (tone) {
    case "available":
      return "bg-[var(--admin-availability-high)] text-[var(--admin-success-text)]";
    case "low":
      return "bg-[var(--admin-availability-low)] text-[#5b4600]";
    case "full":
      return "bg-[var(--admin-availability-full)] text-[#7f1d1d]";
    case "weekend":
      return "bg-[var(--admin-availability-weekend)] text-[rgba(107,114,128,0.85)]";
    default:
      return "bg-[var(--admin-inactive-bg)] text-[var(--admin-text-secondary)]";
  }
}

function toBaseTimeSlot(
  value: string,
): (typeof BASE_TIME_SLOTS)[number] | null {
  return BASE_TIME_SLOTS.includes(value as (typeof BASE_TIME_SLOTS)[number])
    ? (value as (typeof BASE_TIME_SLOTS)[number])
    : null;
}

function buildCalendarCells(
  month: string,
  calendarDays: MonthDetailCalendarDay[],
) {
  const firstDate = new Date(`${month}-01T12:00:00.000Z`);
  const firstWeekday = firstDate.getUTCDay();
  const leadingPlaceholders = Array.from(
    { length: firstWeekday },
    (_, index) => ({
      key: `leading-${index}`,
      day: null as number | null,
    }),
  );

  const dayCells = calendarDays.map((day) => ({
    key: day.date,
    day,
  }));

  return [...leadingPlaceholders, ...dayCells];
}

export function MonthDetailView({ month, initialData }: MonthDetailViewProps) {
  const { t, i18n } = useTranslation("admin");
  const language = resolveAppLanguage(i18n.resolvedLanguage ?? "es");
  const locale = resolveLocale(language);
  const { data, isLoading, errorCode, refresh } = useMonthDetail({
    month,
    initialData,
  });
  const dayAgendaModal = useDayAgendaModal(data.month);
  const blockSpacesModal = useBlockSpacesModal(data.month);
  const [editDate, setEditDate] = useState<string>("");
  const [editTimeSlot, setEditTimeSlot] = useState<string>(BASE_TIME_SLOTS[0]);
  const [availableEditSlots, setAvailableEditSlots] = useState<string[]>([]);
  const [processingAppointmentId, setProcessingAppointmentId] = useState<
    number | null
  >(null);
  const [isUpdatingSlotMode, setIsUpdatingSlotMode] = useState(false);
  const [isSlotModeModalOpen, setIsSlotModeModalOpen] = useState(false);
  const [slotModeDraft, setSlotModeDraft] = useState<MonthSlotMode>(
    initialData.slotMode,
  );

  const monthTitle = formatMonthLabel(data.month, language);
  const calendarCells = useMemo(
    () => buildCalendarCells(data.month, data.calendarDays),
    [data.calendarDays, data.month],
  );
  const editingAppointment = useMemo(
    () =>
      dayAgendaModal.agenda?.appointments.find(
        (appointment) =>
          appointment.appointmentId === dayAgendaModal.editingAppointmentId,
      ) ?? null,
    [dayAgendaModal.agenda, dayAgendaModal.editingAppointmentId],
  );
  const agendaDateOptions = useMemo<SelectOption[]>(
    () =>
      data.calendarDays
        .filter((day) => {
          if (day.isWeekend || day.date < data.currentDate) {
            return false;
          }

          if (editingAppointment?.date === day.date) {
            return true;
          }

          return day.availableSpaces > 0;
        })
        .map((day) => ({
          value: day.date,
          label: new Intl.DateTimeFormat(locale, {
            timeZone: "America/Mexico_City",
            day: "2-digit",
            month: "short",
          }).format(parseDateOnly(day.date)),
        })),
    [data.calendarDays, data.currentDate, editingAppointment?.date, locale],
  );
  const timeSlotOptions = useMemo<SelectOption[]>(
    () =>
      availableEditSlots.map((slot) => ({
        value: slot,
        label: formatTimeSlotLabel(slot, language),
      })),
    [availableEditSlots, language],
  );
  const dayLabelFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        timeZone: "America/Mexico_City",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
    [locale],
  );
  const selectedDateLabel = dayAgendaModal.selectedDate
    ? dayLabelFormatter.format(parseDateOnly(dayAgendaModal.selectedDate))
    : "";
  const slotModeHelperKey =
    slotModeDraft === "BLOCK_MODE"
      ? "monthsDetail.slotMode.helpers.block"
      : "monthsDetail.slotMode.helpers.secondOnly";

  function startEditing(appointment: AdminDayAgendaItem) {
    dayAgendaModal.setEditingAppointmentId(appointment.appointmentId);
    setEditDate(appointment.date);
    setEditTimeSlot(appointment.timeSlot);
  }

  function stopEditing() {
    dayAgendaModal.setEditingAppointmentId(null);
    setAvailableEditSlots([]);
  }

  useEffect(() => {
    if (!dayAgendaModal.editingAppointmentId || !editDate) {
      setAvailableEditSlots([]);
      return;
    }

    const controller = new AbortController();

    async function loadAvailableSlots() {
      try {
        const agendaForEditDate =
          dayAgendaModal.agenda?.date === editDate
            ? dayAgendaModal.agenda
            : await fetchAdminDayAgenda(
                data.month,
                editDate,
                controller.signal,
              );

        const occupiedSlots = agendaForEditDate.appointments
          .filter(
            (appointment) =>
              appointment.appointmentId !== dayAgendaModal.editingAppointmentId,
          )
          .map((appointment) => appointment.timeSlot.slice(0, 5));

        const monthBaseSlots = resolveBaseSlotsByMonthMode(data.slotMode);
        const slots = getAvailableStartSlots(
          monthBaseSlots,
          occupiedSlots,
        ).filter((slot) => isFutureDateTime(editDate, slot));

        setAvailableEditSlots(slots);
      } catch {
        setAvailableEditSlots([]);
      }
    }

    void loadAvailableSlots();

    return () => {
      controller.abort();
    };
  }, [
    data.month,
    data.slotMode,
    dayAgendaModal.agenda,
    dayAgendaModal.editingAppointmentId,
    editDate,
  ]);

  useEffect(() => {
    if (!dayAgendaModal.editingAppointmentId) {
      return;
    }

    if (availableEditSlots.length === 0) {
      setEditTimeSlot("");
      return;
    }

    if (!availableEditSlots.includes(editTimeSlot)) {
      setEditTimeSlot(availableEditSlots[0]);
    }
  }, [availableEditSlots, dayAgendaModal.editingAppointmentId, editTimeSlot]);

  useEffect(() => {
    if (isSlotModeModalOpen) {
      return;
    }

    setSlotModeDraft(data.slotMode);
  }, [data.slotMode, isSlotModeModalOpen]);

  async function handleReschedule(appointmentId: number) {
    const normalizedTimeSlot = toBaseTimeSlot(editTimeSlot);

    if (!editDate || !normalizedTimeSlot) {
      return;
    }

    stopEditing();
    setProcessingAppointmentId(appointmentId);

    try {
      await sileo.promise(
        rescheduleAdminAppointmentById(appointmentId, {
          month: data.month,
          date: editDate,
          timeSlot: normalizedTimeSlot,
        }),
        {
          loading: {
            title: t("monthsDetail.dayModal.notifications.rescheduleLoading"),
          },
          success: {
            title: t("monthsDetail.dayModal.notifications.rescheduleSuccess"),
          },
          error: {
            title: t("monthsDetail.dayModal.notifications.rescheduleError"),
          },
        },
      );
    } finally {
      setProcessingAppointmentId(null);
      await Promise.all([dayAgendaModal.refresh(), refresh()]);
    }
  }

  async function handleCancel(appointment: AdminDayAgendaItem) {
    const confirmationMessage = t(
      "monthsDetail.dayModal.confirmCancel.question",
      {
        name: appointment.name,
        time: formatTimeSlotLabel(appointment.timeSlot, language),
      },
    );

    if (!window.confirm(confirmationMessage)) {
      return;
    }

    setProcessingAppointmentId(appointment.appointmentId);

    try {
      await sileo.promise(
        cancelAdminAppointmentById(appointment.appointmentId, {
          month: data.month,
        }),
        {
          loading: {
            title: t("monthsDetail.dayModal.notifications.cancelLoading"),
          },
          success: {
            title: t("monthsDetail.dayModal.notifications.cancelSuccess"),
          },
          error: {
            title: t("monthsDetail.dayModal.notifications.cancelError"),
          },
        },
      );
    } finally {
      setProcessingAppointmentId(null);
      await Promise.all([dayAgendaModal.refresh(), refresh()]);
    }
  }

  async function handleConfirmBlockedSlots() {
    await sileo.promise(
      blockSpacesModal.submit(async () => {
        await refresh();
      }),
      {
        loading: {
          title: t("monthsDetail.blockModal.notifications.submitLoading"),
        },
        success: {
          title: t("monthsDetail.blockModal.notifications.submitSuccess"),
        },
        error: {
          title: t("monthsDetail.blockModal.notifications.submitError"),
        },
      },
    );
  }

  async function handleUpdateMonthSlotMode() {
    if (slotModeDraft === data.slotMode || isUpdatingSlotMode) {
      setIsSlotModeModalOpen(false);
      return;
    }

    setIsUpdatingSlotMode(true);

    try {
      await sileo.promise(updateAdminMonthSlotMode(data.month, slotModeDraft), {
        loading: {
          title: t("monthsDetail.slotMode.notifications.updateLoading"),
        },
        success: {
          title: t("monthsDetail.slotMode.notifications.updateSuccess"),
        },
        error: {
          title: t("monthsDetail.slotMode.notifications.updateError"),
        },
      });

      await refresh();

      if (blockSpacesModal.isOpen) {
        await blockSpacesModal.open();
      }

      setIsSlotModeModalOpen(false);
    } finally {
      setIsUpdatingSlotMode(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[412px] flex-col gap-4 px-3 py-4">
      <section className="flex items-center gap-2">
        <Link
          href="/admin/months"
          aria-label={t("monthsDetail.header.back")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-accent)] transition hover:bg-[var(--admin-inactive-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)]"
        >
          <AdminIcon icon={adminIcons.back} />
        </Link>
        <h1 className="text-2xl font-bold text-[var(--admin-accent)]">
          {monthTitle}
        </h1>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setSlotModeDraft(data.slotMode);
            setIsSlotModeModalOpen(true);
          }}
          aria-label={t("monthsDetail.slotMode.openCta")}
          disabled={isLoading || isUpdatingSlotMode}
          className="ml-auto h-10 w-10 justify-center rounded-full p-0"
        >
          <AdminIcon icon={adminIcons.slotModeSettings} tone="secondary" />
        </Button>
        {data.isPastMonth ? (
          <span className="ml-auto rounded-full bg-[var(--admin-inactive-bg)] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--admin-text-secondary)]">
            {t("monthsDetail.header.historical")}
          </span>
        ) : null}
      </section>

      {errorCode ? (
        <Card className="space-y-3">
          <p className="text-sm font-semibold text-[var(--admin-text-primary)]">
            {t("monthsDetail.errors.loadFailed")}
          </p>
          <p className="text-xs text-[var(--admin-text-secondary)]">
            {errorCode}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={refresh}
            disabled={isLoading}
          >
            {t("monthsDetail.errors.retry")}
          </Button>
        </Card>
      ) : null}

      <section className="grid grid-cols-2 gap-3">
        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <AdminIcon
              icon={adminIcons.monthDetailConfirmed}
              tone="accent"
              className="text-green-700"
            />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-secondary)]">
              {t("monthsDetail.metrics.confirmed")}
            </span>
          </div>
          <p className="text-3xl font-extrabold leading-none text-[var(--admin-text-primary)]">
            {data.metrics.confirmedAppointments.toString().padStart(2, "0")}
          </p>
        </Card>

        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <AdminIcon
              icon={adminIcons.monthDetailCancelled}
              tone="accent"
              className="text-red-700"
            />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-secondary)]">
              {t("monthsDetail.metrics.cancelled")}
            </span>
          </div>
          <p className="text-3xl font-extrabold leading-none text-[var(--admin-text-primary)]">
            {data.metrics.cancelledAppointments.toString().padStart(2, "0")}
          </p>
        </Card>

        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <AdminIcon icon={adminIcons.monthDetailAvailable} tone="primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-secondary)]">
              {t("monthsDetail.metrics.available")}
            </span>
          </div>
          <p className="text-3xl font-extrabold leading-none text-[var(--admin-text-primary)]">
            {data.metrics.availableSpaces.toString().padStart(2, "0")}
          </p>
        </Card>

        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <AdminIcon icon={adminIcons.monthDetailBlocked} tone="secondary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--admin-text-secondary)]">
              {t("monthsDetail.metrics.blocked")}
            </span>
          </div>
          <p className="text-3xl font-extrabold leading-none text-[var(--admin-text-primary)]">
            {data.metrics.blockedSpaces.toString().padStart(2, "0")}
          </p>
        </Card>
      </section>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[var(--admin-text-primary)]">
            {t("monthsDetail.saturation.title")}
          </h2>
          <span className="text-2xl font-extrabold text-[var(--admin-accent)]">
            {data.projectedSaturationPercent}%
          </span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-[var(--admin-inactive-bg)]">
          <div
            className="h-full rounded-full bg-[var(--admin-accent)] transition-[width] duration-300"
            style={{ width: `${data.projectedSaturationPercent}%` }}
            role="progressbar"
            aria-valuenow={data.projectedSaturationPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t("monthsDetail.saturation.ariaLabel")}
          />
        </div>
      </Card>

      <Card className="space-y-4 p-4">
        <h2 className="text-xl font-bold text-[var(--admin-text-primary)]">
          {t("monthsDetail.calendar.title")}
        </h2>

        <div className="grid grid-cols-7 gap-1.5 text-center">
          {weekdayOrder.map((weekday) => (
            <span
              key={weekday}
              className="text-[11px] font-bold uppercase tracking-widest text-[var(--admin-text-secondary)]"
            >
              {t(`monthsDetail.calendar.weekdays.${weekday}`)}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {calendarCells.map((cell) => {
            if (!("day" in cell) || !cell.day) {
              return (
                <div key={cell.key} className="h-11 rounded-lg" aria-hidden />
              );
            }

            return (
              <button
                type="button"
                key={cell.key}
                className={`flex h-11 items-center justify-center rounded-lg border border-transparent text-sm font-semibold ${getToneClasses(cell.day.tone)}`}
                title={cell.day.date}
                onClick={() => void dayAgendaModal.open(cell.day.date)}
                aria-label={t("monthsDetail.dayModal.title", {
                  date: dayLabelFormatter.format(parseDateOnly(cell.day.date)),
                })}
              >
                {cell.day.day}
              </button>
            );
          })}
        </div>
      </Card>

      <Button
        type="button"
        variant="secondary"
        fullWidth
        disabled={isLoading || isUpdatingSlotMode}
        onClick={() => void blockSpacesModal.open()}
        className="h-12"
      >
        {t("monthsDetail.blockModal.openCta")}
      </Button>

      <BottomSheetModal
        isOpen={isSlotModeModalOpen}
        onClose={() => {
          if (isUpdatingSlotMode) {
            return;
          }

          setIsSlotModeModalOpen(false);
        }}
        title={t("monthsDetail.slotMode.title")}
        closeLabel={t("monthsDetail.slotMode.close")}
      >
        <div className="space-y-4">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--admin-text-secondary)]">
            {t("monthsDetail.slotMode.sectionTitle")}
          </h3>
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setSlotModeDraft("BLOCK_MODE")}
              disabled={isUpdatingSlotMode}
              aria-pressed={slotModeDraft === "BLOCK_MODE"}
              className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] ${
                slotModeDraft === "BLOCK_MODE"
                  ? "border-transparent bg-[var(--admin-primary)] text-white"
                  : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-primary)]"
              }`}
            >
              <span className="font-semibold">
                {t("monthsDetail.slotMode.options.block")}
              </span>
              <AdminIcon
                icon={adminIcons.monthDetailAvailable}
                tone={slotModeDraft === "BLOCK_MODE" ? "primary" : "secondary"}
                className={slotModeDraft === "BLOCK_MODE" ? "text-white" : null}
              />
            </button>
            <button
              type="button"
              onClick={() => setSlotModeDraft("SECOND_ONLY_MODE")}
              disabled={isUpdatingSlotMode}
              aria-pressed={slotModeDraft === "SECOND_ONLY_MODE"}
              className={`flex min-h-12 w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] ${
                slotModeDraft === "SECOND_ONLY_MODE"
                  ? "border-transparent bg-[var(--admin-primary)] text-white"
                  : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-primary)]"
              }`}
            >
              <span className="font-semibold">
                {t("monthsDetail.slotMode.options.secondOnly")}
              </span>
              <AdminIcon
                icon={adminIcons.blockSchedule}
                tone={
                  slotModeDraft === "SECOND_ONLY_MODE" ? "primary" : "secondary"
                }
                className={
                  slotModeDraft === "SECOND_ONLY_MODE" ? "text-white" : null
                }
              />
            </button>
          </div>
          <p className="text-xs text-[var(--admin-text-secondary)]">
            {t(slotModeHelperKey)}
          </p>
          <Button
            type="button"
            fullWidth
            disabled={isUpdatingSlotMode}
            onClick={() => void handleUpdateMonthSlotMode()}
          >
            {isUpdatingSlotMode
              ? t("monthsDetail.slotMode.saving")
              : t("monthsDetail.slotMode.save")}
          </Button>
        </div>
      </BottomSheetModal>

      <BottomSheetModal
        isOpen={dayAgendaModal.isOpen}
        onClose={dayAgendaModal.close}
        title={t("monthsDetail.dayModal.title", { date: selectedDateLabel })}
        closeLabel={t("monthsDetail.dayModal.close")}
      >
        <div className="space-y-4">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--admin-text-secondary)]">
            {t("monthsDetail.dayModal.sectionTitle")}
          </h3>

          {dayAgendaModal.isLoadingAgenda ? (
            <p className="rounded-xl bg-[var(--admin-inactive-bg)] p-4 text-sm text-[var(--admin-text-secondary)]">
              {t("monthsDetail.dayModal.loading")}
            </p>
          ) : null}

          {!dayAgendaModal.isLoadingAgenda && dayAgendaModal.agendaErrorCode ? (
            <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
              <p className="text-sm font-medium text-[var(--admin-text-primary)]">
                {t("monthsDetail.errors.loadFailed")}
              </p>
              <p className="mt-1 text-xs text-[var(--admin-text-secondary)]">
                {dayAgendaModal.agendaErrorCode}
              </p>
              <div className="mt-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={dayAgendaModal.refresh}
                >
                  {t("monthsDetail.errors.retry")}
                </Button>
              </div>
            </div>
          ) : null}

          {!dayAgendaModal.isLoadingAgenda &&
          !dayAgendaModal.agendaErrorCode &&
          dayAgendaModal.agenda &&
          dayAgendaModal.agenda.appointments.length === 0 ? (
            <p className="rounded-xl bg-[var(--admin-inactive-bg)] p-4 text-sm text-[var(--admin-text-secondary)]">
              {t("monthsDetail.dayModal.empty")}
            </p>
          ) : null}

          {!dayAgendaModal.isLoadingAgenda &&
          !dayAgendaModal.agendaErrorCode &&
          dayAgendaModal.agenda ? (
            <div className="space-y-3">
              {dayAgendaModal.agenda.appointments.map((appointment) => (
                <article
                  key={appointment.appointmentId}
                  className="rounded-2xl bg-[var(--admin-surface)] px-4 py-3 shadow-sm"
                >
                  <div className="flex min-h-[72px] items-center gap-3">
                    <span className="w-20 text-left font-bold text-[var(--admin-accent)]">
                      {formatTimeSlotLabel(appointment.timeSlot, language)}
                    </span>
                    <div className="flex-1">
                      <p className="font-semibold text-[var(--admin-text-primary)]">
                        {appointment.name}
                      </p>
                      <p className="text-sm text-[var(--admin-text-secondary)]">
                        {appointment.phone}
                      </p>
                    </div>
                    {processingAppointmentId === appointment.appointmentId ? (
                      <div
                        className="inline-flex h-11 w-11 items-center justify-center"
                        role="status"
                        aria-label={t("monthsDetail.dayModal.loading")}
                      >
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-[var(--admin-border)] border-t-[var(--admin-accent)]" />
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <button
                          type="button"
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--admin-text-secondary)] transition hover:bg-[var(--admin-inactive-bg)] hover:text-[var(--admin-accent)]"
                          aria-label={t("monthsDetail.dayModal.actions.edit")}
                          onClick={() => startEditing(appointment)}
                        >
                          <AdminIcon icon={adminIcons.edit} tone="secondary" />
                        </button>
                        <button
                          type="button"
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--admin-text-secondary)] transition hover:bg-[rgba(254,226,226,0.7)] hover:text-red-700"
                          aria-label={t("monthsDetail.dayModal.actions.delete")}
                          onClick={() => void handleCancel(appointment)}
                        >
                          <AdminIcon
                            icon={adminIcons.delete}
                            tone="secondary"
                          />
                        </button>
                      </div>
                    )}
                  </div>

                  {dayAgendaModal.editingAppointmentId ===
                  appointment.appointmentId ? (
                    <div className="mt-3 space-y-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-inactive-bg)] p-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-[var(--admin-text-secondary)]">
                          {t("monthsDetail.dayModal.edit.date")}
                        </label>
                        <Select
                          value={editDate}
                          options={agendaDateOptions}
                          onChange={setEditDate}
                          showPlaceholder={false}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-[var(--admin-text-secondary)]">
                          {t("monthsDetail.dayModal.edit.timeSlot")}
                        </label>
                        <Select
                          value={editTimeSlot}
                          options={timeSlotOptions}
                          onChange={setEditTimeSlot}
                          showPlaceholder={timeSlotOptions.length === 0}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          onClick={() =>
                            void handleReschedule(appointment.appointmentId)
                          }
                        >
                          {t("monthsDetail.dayModal.actions.save")}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={stopEditing}
                        >
                          {t("monthsDetail.dayModal.actions.cancel")}
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </article>
              ))}
            </div>
          ) : null}
        </div>
      </BottomSheetModal>

      <BlockSpacesModal
        isOpen={blockSpacesModal.isOpen}
        isLoadingDays={blockSpacesModal.isLoadingDays}
        isSubmitting={blockSpacesModal.isSubmitting}
        isReadyToSubmit={blockSpacesModal.isReadyToSubmit}
        errorCode={blockSpacesModal.errorCode}
        days={blockSpacesModal.days}
        selectedDate={blockSpacesModal.selectedDate}
        currentDate={data.currentDate}
        selectedDaySlots={blockSpacesModal.selectedDaySlots}
        selectedSlots={blockSpacesModal.selectedSlots}
        areAllSelectedForDay={blockSpacesModal.areAllSelectedForDay}
        reason={blockSpacesModal.reason}
        allowBlockView={data.slotMode === "BLOCK_MODE"}
        slotViewMode={blockSpacesModal.slotViewMode}
        onClose={blockSpacesModal.close}
        onRetry={() => void blockSpacesModal.open()}
        onSelectDate={blockSpacesModal.selectDate}
        onToggleSlot={blockSpacesModal.toggleSlot}
        onToggleBlockSlots={blockSpacesModal.toggleBlockSlots}
        onSelectAllSlots={blockSpacesModal.selectAllSlotsForDay}
        onClearSelectedSlots={blockSpacesModal.clearSelectedSlots}
        onReasonChange={blockSpacesModal.setReason}
        onSlotViewModeChange={blockSpacesModal.setSlotViewMode}
        onSubmit={() => void handleConfirmBlockedSlots()}
      />
    </main>
  );
}
