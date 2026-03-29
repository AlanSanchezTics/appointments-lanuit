"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { sileo } from "sileo";

import { BlockSpacesModal } from "@/components/admin/months/BlockSpacesModal";
import { BookAppointmentModal } from "@/components/admin/months/BookAppointmentModal";
import type { AdminDayAgendaItem } from "@/lib/admin/appointments/types";
import {
  cancelAdminAppointmentById,
  fetchAdminDayAgenda,
  rescheduleAdminAppointmentById,
} from "@/lib/admin/appointments/api-client";
import {
  deleteAdminBlockedSlotById,
  updateAdminBlockedSlotById,
} from "@/lib/admin/blocked-spaces/api-client";
import {
  updateAdminMonthStatus,
  updateAdminMonthSlotMode,
} from "@/lib/admin/months/api-client";
import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { BottomSheetModal } from "@/components/admin/ui/BottomSheetModal";
import { Button } from "@/components/admin/ui/Button";
import { Card } from "@/components/admin/ui/Card";
import { Select, type SelectOption } from "@/components/admin/ui/Select";
import { adminIcons } from "@/components/admin/ui/admin-icons";
import { useBlockSpacesModal } from "@/hooks/admin/months/useBlockSpacesModal";
import { useBookAppointmentModal } from "@/hooks/admin/months/useBookAppointmentModal";
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
import { getAvailableStartSlotsWithManualBlocks } from "@/lib/availability/rules";
import type { AppLanguage } from "@/lib/i18n/config";
import type {
  ActiveMonthStatus,
  MonthSlotMode,
  MonthDetailCalendarDay,
  MonthDetailResponse,
} from "@/lib/admin/months/types";
import type { BlockReason } from "@/lib/admin/blocked-spaces/types";

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

function resolveBookAppointmentErrorDescriptionKey(errorCode: string) {
  switch (errorCode) {
    case "PHONE_ALREADY_BOOKED":
      return "monthsDetail.bookModal.notifications.errorDescriptions.phoneAlreadyBooked";
    case "SLOT_NOT_AVAILABLE":
    case "SLOT_LOCKED":
      return "monthsDetail.bookModal.notifications.errorDescriptions.slotUnavailable";
    case "MONTH_NOT_ACTIVE":
      return "monthsDetail.bookModal.notifications.errorDescriptions.monthNotActive";
    case "MONTH_NOT_REGISTERED":
      return "monthsDetail.bookModal.notifications.errorDescriptions.monthNotFound";
    default:
      return "monthsDetail.bookModal.notifications.errorDescriptions.generic";
  }
}

function resolveDayModalRescheduleErrorDescriptionKey(errorCode: string) {
  switch (errorCode) {
    case "APPOINTMENT_NOT_EDITABLE":
      return "monthsDetail.dayModal.notifications.errorDescriptions.appointmentNotEditable";
    case "SLOT_NOT_AVAILABLE":
    case "SLOT_LOCKED":
      return "monthsDetail.dayModal.notifications.errorDescriptions.slotUnavailable";
    case "MONTH_NOT_REGISTERED":
      return "monthsDetail.dayModal.notifications.errorDescriptions.monthNotFound";
    case "APPOINTMENT_NOT_FOUND":
      return "monthsDetail.dayModal.notifications.errorDescriptions.appointmentNotFound";
    default:
      return "monthsDetail.dayModal.notifications.errorDescriptions.generic";
  }
}

function resolveDayModalCancelErrorDescriptionKey(errorCode: string) {
  switch (errorCode) {
    case "MONTH_NOT_REGISTERED":
      return "monthsDetail.dayModal.notifications.errorDescriptions.monthNotFound";
    case "APPOINTMENT_NOT_FOUND":
      return "monthsDetail.dayModal.notifications.errorDescriptions.appointmentNotFound";
    default:
      return "monthsDetail.dayModal.notifications.errorDescriptions.generic";
  }
}

function getToneClasses(
  tone: MonthDetailCalendarDay["tone"],
  isCurrentDay: boolean,
) {
  if (isCurrentDay) {
    return "bg-[color-mix(in_srgb,var(--admin-primary)_20%,white)] text-[var(--admin-accent)]";
  }

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
  const bookAppointmentModal = useBookAppointmentModal(data.month);
  const [editDate, setEditDate] = useState<string>("");
  const [editTimeSlot, setEditTimeSlot] = useState<string>(BASE_TIME_SLOTS[0]);
  const [availableEditSlots, setAvailableEditSlots] = useState<string[]>([]);
  const [processingAppointmentId, setProcessingAppointmentId] = useState<
    number | null
  >(null);
  const [editingBlockedSlotId, setEditingBlockedSlotId] = useState<
    number | null
  >(null);
  const [editingBlockedReason, setEditingBlockedReason] =
    useState<BlockReason>("DESCANSO");
  const [processingBlockedSlotId, setProcessingBlockedSlotId] = useState<
    number | null
  >(null);
  const [isUpdatingSlotMode, setIsUpdatingSlotMode] = useState(false);
  const [isSlotModeModalOpen, setIsSlotModeModalOpen] = useState(false);
  const [slotModeDraft, setSlotModeDraft] = useState<MonthSlotMode>(
    initialData.slotMode,
  );
  const [isUpdatingMonthStatus, setIsUpdatingMonthStatus] = useState(false);

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
    const normalizedTimeSlot = appointment.timeSlot.slice(0, 5);

    if (!isFutureDateTime(appointment.date, normalizedTimeSlot)) {
      sileo.warning({
        title: t("monthsDetail.dayModal.notifications.rescheduleError"),
        description: t(
          "monthsDetail.dayModal.notifications.errorDescriptions.appointmentNotEditable",
        ),
      });
      return;
    }

    dayAgendaModal.setEditingAppointmentId(appointment.appointmentId);
    setEditDate(appointment.date);
    setEditTimeSlot(normalizedTimeSlot);
  }

  function stopEditing() {
    dayAgendaModal.setEditingAppointmentId(null);
    setAvailableEditSlots([]);
  }

  function closeDayAgendaModal() {
    stopEditing();
    setEditingBlockedSlotId(null);
    setEditingBlockedReason("DESCANSO");
    setProcessingBlockedSlotId(null);
    dayAgendaModal.close();
  }

  function startEditingBlockedSlot(blockedSlotId: number, reason: BlockReason) {
    setEditingBlockedSlotId(blockedSlotId);
    setEditingBlockedReason(reason);
  }

  function stopEditingBlockedSlot() {
    setEditingBlockedSlotId(null);
    setEditingBlockedReason("DESCANSO");
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
        const blockedSlots = agendaForEditDate.blockedSlots.map((blockedSlot) =>
          blockedSlot.timeSlot.slice(0, 5),
        );
        const slots = getAvailableStartSlotsWithManualBlocks(
          monthBaseSlots,
          occupiedSlots,
          blockedSlots,
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
          error: (error: unknown) => {
            const errorCode =
              error instanceof Error ? error.message : "UNKNOWN_ERROR";

            return {
              title: t("monthsDetail.dayModal.notifications.rescheduleError"),
              description: t(
                resolveDayModalRescheduleErrorDescriptionKey(errorCode),
              ),
            };
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
          error: (error: unknown) => {
            const errorCode =
              error instanceof Error ? error.message : "UNKNOWN_ERROR";

            return {
              title: t("monthsDetail.dayModal.notifications.cancelError"),
              description: t(
                resolveDayModalCancelErrorDescriptionKey(errorCode),
              ),
            };
          },
        },
      );
    } finally {
      setProcessingAppointmentId(null);
      await Promise.all([dayAgendaModal.refresh(), refresh()]);
    }
  }

  async function handleUpdateBlockedSlotReason(blockedSlotId: number) {
    if (processingBlockedSlotId !== null) {
      return;
    }

    setProcessingBlockedSlotId(blockedSlotId);

    try {
      await sileo.promise(
        updateAdminBlockedSlotById({
          month: data.month,
          blockedSlotId,
          reason: editingBlockedReason,
        }),
        {
          loading: {
            title: t(
              "monthsDetail.dayModal.blocked.notifications.updateLoading",
            ),
          },
          success: {
            title: t(
              "monthsDetail.dayModal.blocked.notifications.updateSuccess",
            ),
          },
          error: {
            title: t("monthsDetail.dayModal.blocked.notifications.updateError"),
          },
        },
      );
      stopEditingBlockedSlot();
      await Promise.all([dayAgendaModal.refresh(), refresh()]);
    } finally {
      setProcessingBlockedSlotId(null);
    }
  }

  async function handleDeleteBlockedSlot(input: {
    blockedSlotId: number;
    reason: BlockReason;
    timeSlot: string;
  }) {
    const confirmed = window.confirm(
      t("monthsDetail.dayModal.blocked.confirmDelete.question", {
        time: formatTimeSlotLabel(input.timeSlot, language),
        reason: t(`monthsDetail.blockModal.reasons.${input.reason}`),
      }),
    );

    if (!confirmed) {
      return;
    }

    setProcessingBlockedSlotId(input.blockedSlotId);

    try {
      await sileo.promise(
        deleteAdminBlockedSlotById({
          month: data.month,
          blockedSlotId: input.blockedSlotId,
        }),
        {
          loading: {
            title: t(
              "monthsDetail.dayModal.blocked.notifications.deleteLoading",
            ),
          },
          success: {
            title: t(
              "monthsDetail.dayModal.blocked.notifications.deleteSuccess",
            ),
          },
          error: {
            title: t("monthsDetail.dayModal.blocked.notifications.deleteError"),
          },
        },
      );
      stopEditingBlockedSlot();
      await Promise.all([dayAgendaModal.refresh(), refresh()]);
    } finally {
      setProcessingBlockedSlotId(null);
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

  async function handleCreateAdminAppointment() {
    try {
      await sileo.promise(bookAppointmentModal.submit(), {
        loading: {
          title: t("monthsDetail.bookModal.notifications.submitLoading"),
        },
        success: {
          title: t("monthsDetail.bookModal.notifications.submitSuccess"),
        },
        error: (error: unknown) => {
          const errorCode =
            error instanceof Error ? error.message : "UNKNOWN_ERROR";

          return {
            title: t("monthsDetail.bookModal.notifications.submitError"),
            description: t(
              resolveBookAppointmentErrorDescriptionKey(errorCode),
            ),
          };
        },
      });
    } catch {
      try {
        await bookAppointmentModal.refreshAvailability();
      } catch {
        // keep original error toast feedback
      }
    }
  }

  async function handleOpenBookAppointmentModal() {
    try {
      await bookAppointmentModal.open();
    } catch (error) {
      const errorCode =
        error instanceof Error ? error.message : "UNKNOWN_ERROR";
      sileo.error({
        title: t("monthsDetail.bookModal.notifications.submitError"),
        description: t(resolveBookAppointmentErrorDescriptionKey(errorCode)),
      });
    }
  }

  async function handleBackFromBookingSuccess() {
    bookAppointmentModal.close();
    await refresh();
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

  async function handleUpdateMonthStatus(nextStatus: ActiveMonthStatus) {
    if (nextStatus === data.monthStatus || isUpdatingMonthStatus) {
      return;
    }

    setIsUpdatingMonthStatus(true);

    try {
      await sileo.promise(updateAdminMonthStatus(data.month, nextStatus), {
        loading: {
          title: t("monthsDetail.monthStatus.notifications.updateLoading"),
        },
        success: {
          title: t("monthsDetail.monthStatus.notifications.updateSuccess"),
        },
        error: {
          title: t("monthsDetail.monthStatus.notifications.updateError"),
        },
      });

      await refresh();
    } finally {
      setIsUpdatingMonthStatus(false);
    }
  }

  const monthStatusTagClassName =
    data.monthStatus === "ACTIVE"
      ? "bg-[rgba(34,197,94,0.15)] text-[rgb(21,128,61)]"
      : "bg-[rgba(239,68,68,0.15)] text-[rgb(185,28,28)]";
  const monthStatusTagText =
    data.monthStatus === "ACTIVE"
      ? t("monthsDetail.monthStatus.tag.active")
      : t("monthsDetail.monthStatus.tag.inactive");
  const nextMonthStatus: ActiveMonthStatus =
    data.monthStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
  const monthStatusToggleClassName =
    data.monthStatus === "ACTIVE"
      ? "h-12 border-transparent bg-[var(--admin-availability-full)]! text-[#7f1d1d]! hover:brightness-95 focus-visible:outline-[#7f1d1d]"
      : "h-12 border-transparent bg-[var(--admin-availability-high)]! text-[var(--admin-success-text)]! hover:brightness-95 focus-visible:outline-[var(--admin-success-text)]";
  const monthStatusToggleText =
    data.monthStatus === "ACTIVE"
      ? t("monthsDetail.monthStatus.actions.deactivate")
      : t("monthsDetail.monthStatus.actions.activate");

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
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${monthStatusTagClassName}`}
        >
          {monthStatusTagText}
        </span>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            setSlotModeDraft(data.slotMode);
            setIsSlotModeModalOpen(true);
          }}
          aria-label={t("monthsDetail.slotMode.openCta")}
          disabled={isLoading || isUpdatingSlotMode || isUpdatingMonthStatus}
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

            const isActionableDay = !cell.day.isWeekend;
            const dayToneClasses = getToneClasses(
              cell.day.tone,
              cell.day.date === data.currentDate,
            );

            return (
              <button
                type="button"
                key={cell.key}
                disabled={!isActionableDay}
                className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg border border-transparent text-sm font-semibold ${dayToneClasses} disabled:cursor-not-allowed disabled:opacity-75`}
                title={cell.day.date}
                onClick={() => {
                  if (!isActionableDay) {
                    return;
                  }

                  void dayAgendaModal.open(cell.day.date);
                }}
                aria-label={t("monthsDetail.dayModal.title", {
                  date: dayLabelFormatter.format(parseDateOnly(cell.day.date)),
                })}
              >
                <span>{cell.day.day}</span>
                {cell.day.appointmentsCount &&
                cell.day.appointmentsCount > 0 ? (
                  <span
                    className="mt-0.5 flex items-center justify-center gap-0.5"
                    aria-hidden
                  >
                    {Array.from({
                      length: Math.min(cell.day.appointmentsCount, 6),
                    }).map((_, index) => (
                      <span
                        key={`${cell.day.date}-dot-${index}`}
                        data-testid={`${cell.day.date}-appointment-dot`}
                        className="h-1.5 w-1.5 rounded-full bg-current"
                      />
                    ))}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </Card>

      <Button
        type="button"
        variant="primary"
        fullWidth
        disabled={
          isLoading ||
          isUpdatingSlotMode ||
          isUpdatingMonthStatus ||
          data.monthStatus !== "ACTIVE"
        }
        onClick={() => void handleOpenBookAppointmentModal()}
        className="h-12"
      >
        <AdminIcon
          icon={adminIcons.addNewAppointment}
          className="text-white! mr-2"
        />
        {t("monthsDetail.bookModal.openCta")}
      </Button>

      <Button
        type="button"
        variant="primary"
        fullWidth
        disabled={isLoading || isUpdatingSlotMode || isUpdatingMonthStatus}
        onClick={() => void blockSpacesModal.open()}
        className="h-12"
      >
        <AdminIcon icon={adminIcons.blockSpaces} className="text-white! mr-2" />
        {t("monthsDetail.blockModal.openCta")}
      </Button>

      <Button
        type="button"
        variant="primary"
        fullWidth
        disabled={isLoading || isUpdatingSlotMode || isUpdatingMonthStatus}
        onClick={() => void handleUpdateMonthStatus(nextMonthStatus)}
        className={monthStatusToggleClassName}
      >
        {monthStatusToggleText}
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
        onClose={closeDayAgendaModal}
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
          dayAgendaModal.agenda.appointments.length === 0 &&
          dayAgendaModal.agenda.blockedSlots.length === 0 ? (
            <p className="rounded-xl bg-[var(--admin-inactive-bg)] p-4 text-sm text-[var(--admin-text-secondary)]">
              {t("monthsDetail.dayModal.empty")}
            </p>
          ) : null}

          {!dayAgendaModal.isLoadingAgenda &&
          !dayAgendaModal.agendaErrorCode &&
          dayAgendaModal.agenda ? (
            <div className="space-y-3">
              {dayAgendaModal.agenda.appointments.map((appointment) => {
                const canEditAppointment = isFutureDateTime(
                  appointment.date,
                  appointment.timeSlot.slice(0, 5),
                );

                return (
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
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--admin-text-secondary)] transition enabled:hover:bg-[var(--admin-inactive-bg)] enabled:hover:text-[var(--admin-accent)] disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={t("monthsDetail.dayModal.actions.edit")}
                            title={
                              canEditAppointment
                                ? undefined
                                : t(
                                    "monthsDetail.dayModal.actions.editDisabled",
                                  )
                            }
                            disabled={!canEditAppointment}
                            onClick={() => startEditing(appointment)}
                          >
                            <AdminIcon
                              icon={adminIcons.edit}
                              tone="secondary"
                            />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--admin-text-secondary)] transition hover:bg-[rgba(254,226,226,0.7)] hover:text-red-700"
                            aria-label={t(
                              "monthsDetail.dayModal.actions.delete",
                            )}
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
                );
              })}

              {dayAgendaModal.agenda.blockedSlots.length > 0 ? (
                <>
                  <h3 className="pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--admin-text-secondary)]">
                    {t("monthsDetail.dayModal.blocked.sectionTitle")}
                  </h3>
                  {dayAgendaModal.agenda.blockedSlots.map((blockedSlot) => {
                    const canEditBlockedSlot = isFutureDateTime(
                      blockedSlot.date,
                      blockedSlot.timeSlot.slice(0, 5),
                    );

                    return (
                      <article
                        key={blockedSlot.blockedSlotId}
                        className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 shadow-sm"
                      >
                      <div className="flex min-h-[72px] items-center gap-3">
                        <span className="w-20 text-left font-bold text-[var(--admin-accent)]">
                          {formatTimeSlotLabel(blockedSlot.timeSlot, language)}
                        </span>
                        <div className="flex-1">
                          <p className="font-semibold text-[var(--admin-text-primary)]">
                            {t(
                              `monthsDetail.blockModal.reasons.${blockedSlot.reason}`,
                            )}
                          </p>
                          <p className="text-sm text-[var(--admin-text-secondary)]">
                            {t("monthsDetail.dayModal.blocked.subtitle")}
                          </p>
                        </div>
                        {processingBlockedSlotId ===
                        blockedSlot.blockedSlotId ? (
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
                              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--admin-text-secondary)] transition enabled:hover:bg-[var(--admin-inactive-bg)] enabled:hover:text-[var(--admin-accent)] disabled:cursor-not-allowed disabled:opacity-40"
                              aria-label={t(
                                "monthsDetail.dayModal.blocked.actions.edit",
                              )}
                              title={
                                canEditBlockedSlot
                                  ? undefined
                                  : t(
                                      "monthsDetail.dayModal.blocked.actions.editDisabled",
                                    )
                              }
                              disabled={!canEditBlockedSlot}
                              onClick={() =>
                                startEditingBlockedSlot(
                                  blockedSlot.blockedSlotId,
                                  blockedSlot.reason,
                                )
                              }
                            >
                              <AdminIcon
                                icon={adminIcons.edit}
                                tone="secondary"
                              />
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[var(--admin-text-secondary)] transition hover:bg-[rgba(254,226,226,0.7)] hover:text-red-700"
                              aria-label={t(
                                "monthsDetail.dayModal.blocked.actions.delete",
                              )}
                              onClick={() =>
                                void handleDeleteBlockedSlot({
                                  blockedSlotId: blockedSlot.blockedSlotId,
                                  reason: blockedSlot.reason,
                                  timeSlot: blockedSlot.timeSlot,
                                })
                              }
                            >
                              <AdminIcon
                                icon={adminIcons.delete}
                                tone="secondary"
                              />
                            </button>
                          </div>
                        )}
                      </div>

                      {editingBlockedSlotId === blockedSlot.blockedSlotId ? (
                        <div className="mt-3 space-y-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-inactive-bg)] p-3">
                          <p className="text-[10px] font-bold uppercase text-[var(--admin-text-secondary)]">
                            {t("monthsDetail.dayModal.blocked.edit.reason")}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {(["DESCANSO", "PERSONAL", "OTRO"] as const).map(
                              (reasonOption) => (
                                <button
                                  key={reasonOption}
                                  type="button"
                                  onClick={() =>
                                    setEditingBlockedReason(reasonOption)
                                  }
                                  className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                                    editingBlockedReason === reasonOption
                                      ? "bg-[var(--admin-success-bg)] text-[var(--admin-success-text)]"
                                      : "bg-[var(--admin-surface)] text-[var(--admin-text-secondary)]"
                                  }`}
                                >
                                  {t(
                                    `monthsDetail.blockModal.reasons.${reasonOption}`,
                                  )}
                                </button>
                              ),
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              onClick={() =>
                                void handleUpdateBlockedSlotReason(
                                  blockedSlot.blockedSlotId,
                                )
                              }
                            >
                              {t("monthsDetail.dayModal.actions.save")}
                            </Button>
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={stopEditingBlockedSlot}
                            >
                              {t("monthsDetail.dayModal.actions.cancel")}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                      </article>
                    );
                  })}
                </>
              ) : null}
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

      <BookAppointmentModal
        isOpen={bookAppointmentModal.isOpen}
        isLoadingDays={bookAppointmentModal.isLoadingDays}
        isSubmitting={bookAppointmentModal.isSubmitting}
        isReadyToSubmit={bookAppointmentModal.isReadyToSubmit}
        errorCode={bookAppointmentModal.errorCode}
        fieldErrors={bookAppointmentModal.fieldErrors}
        days={bookAppointmentModal.days}
        selectedDate={bookAppointmentModal.selectedDate}
        selectedDaySlots={bookAppointmentModal.selectedDaySlots}
        selectedTimeSlot={bookAppointmentModal.selectedTimeSlot}
        clientMode={bookAppointmentModal.clientMode}
        searchQuery={bookAppointmentModal.searchQuery}
        searchResults={bookAppointmentModal.searchResults}
        isSearchingClients={bookAppointmentModal.isSearchingClients}
        selectedClient={bookAppointmentModal.selectedClient}
        newClientName={bookAppointmentModal.newClientName}
        newClientPhone={bookAppointmentModal.newClientPhone}
        successResult={bookAppointmentModal.successResult}
        onClose={bookAppointmentModal.close}
        onSelectDate={bookAppointmentModal.selectDate}
        onSelectTimeSlot={bookAppointmentModal.selectTimeSlot}
        onChangeClientMode={bookAppointmentModal.changeClientMode}
        onSearchQueryChange={bookAppointmentModal.setSearchQuery}
        onSelectClient={bookAppointmentModal.selectClient}
        onNewClientNameChange={bookAppointmentModal.setNewClientName}
        onNewClientPhoneChange={bookAppointmentModal.setNewClientPhone}
        onSubmit={() => void handleCreateAdminAppointment()}
        onBackFromSuccess={() => void handleBackFromBookingSuccess()}
      />
    </main>
  );
}
