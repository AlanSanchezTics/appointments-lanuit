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
  fetchAdminBlockableSlots,
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
import { useShareMonthAgenda } from "@/hooks/admin/months/useShareMonthAgenda";
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

type DayBlockedEntry =
  | {
      kind: "slot";
      blockedSlotId: number;
      date: string;
      timeSlot: string;
      reason: BlockReason;
    }
  | {
      kind: "full-day";
      blockedSlotIds: number[];
      date: string;
      reason: BlockReason;
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

function getToneClasses(day: MonthDetailCalendarDay, isCurrentDay: boolean) {
  if (isCurrentDay) {
    return "bg-[color-mix(in_srgb,var(--admin-primary)_20%,white)] text-[var(--admin-accent)]";
  }

  switch (day.tone) {
    case "available":
      return "bg-[var(--admin-availability-high)] text-[#096ab5]";
    case "low":
      return "bg-[var(--admin-availability-low)] text-[#5b4600]";
    case "full": {
      const hasAppointments = (day.appointmentsCount ?? 0) > 1;

      if (hasAppointments) {
        return "bg-[var(--admin-availability-full)] text-[#065f46]";
      }

      return "bg-[var(--admin-availability-weekend)] text-[#6b7280]";
    }
    case "weekend":
      return "bg-[var(--admin-availability-weekend)] text-[#6b7280]";
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

function buildDayBlockedEntries(input: {
  blockedSlots: Array<{
    blockedSlotId: number;
    date: string;
    timeSlot: string;
    reason: BlockReason;
  }>;
  monthBaseSlots: readonly string[];
}): DayBlockedEntry[] {
  const fullDayMarker = input.blockedSlots.find(
    (blockedSlot) => blockedSlot.timeSlot === "00:00",
  );

  if (fullDayMarker) {
    return [
      {
        kind: "full-day",
        blockedSlotIds: [fullDayMarker.blockedSlotId],
        date: fullDayMarker.date,
        reason: fullDayMarker.reason,
      },
    ];
  }

  const slotsByTime = new Map<
    string,
    {
      blockedSlotId: number;
      date: string;
      timeSlot: string;
      reason: BlockReason;
    }
  >();

  for (const blockedSlot of input.blockedSlots) {
    slotsByTime.set(blockedSlot.timeSlot.slice(0, 5), blockedSlot);
  }

  const hasAllBaseSlotsBlocked = input.monthBaseSlots.every((slot) =>
    slotsByTime.has(slot),
  );

  if (hasAllBaseSlotsBlocked) {
    const firstSlot = slotsByTime.get(input.monthBaseSlots[0]);

    if (!firstSlot) {
      return [];
    }

    return [
      {
        kind: "full-day",
        blockedSlotIds: input.monthBaseSlots
          .map((slot) => slotsByTime.get(slot)?.blockedSlotId)
          .filter((value): value is number => Boolean(value)),
        date: firstSlot.date,
        reason: firstSlot.reason,
      },
    ];
  }

  return input.blockedSlots.map((blockedSlot) => ({
    kind: "slot",
    blockedSlotId: blockedSlot.blockedSlotId,
    date: blockedSlot.date,
    timeSlot: blockedSlot.timeSlot,
    reason: blockedSlot.reason,
  }));
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
      day: null as MonthDetailCalendarDay | null,
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
  const { shareMonthAgenda } = useShareMonthAgenda();
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
  const [hasDayActionableSlots, setHasDayActionableSlots] = useState(false);
  const [isLoadingDayActionableSlots, setIsLoadingDayActionableSlots] =
    useState(false);
  const monthBaseSlots = useMemo(
    () => resolveBaseSlotsByMonthMode(data.slotMode),
    [data.slotMode],
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
  const dayAgenda = dayAgendaModal.agenda;
  const dayBlockedEntries = useMemo(
    () =>
      dayAgenda
        ? buildDayBlockedEntries({
            blockedSlots: dayAgenda.blockedSlots,
            monthBaseSlots,
          })
        : [],
    [dayAgenda, monthBaseSlots],
  );
  const hasFullDayBlockedEntry = dayBlockedEntries.some(
    (entry) => entry.kind === "full-day",
  );
  const selectedAgendaDate = dayAgendaModal.selectedDate;
  const shouldShowDayActionButtons =
    !dayAgendaModal.isLoadingAgenda &&
    !dayAgendaModal.agendaErrorCode &&
    dayAgenda !== null &&
    selectedAgendaDate !== null &&
    selectedAgendaDate >= data.currentDate &&
    !hasFullDayBlockedEntry &&
    hasDayActionableSlots &&
    !isLoadingDayActionableSlots;
  const slotModeHelperKey =
    slotModeDraft === "BLOCK_MODE"
      ? "monthsDetail.slotMode.helpers.block"
      : "monthsDetail.slotMode.helpers.secondOnly";
  const saturationComparison = useMemo(() => {
    if (!data.saturationComparison) {
      return null;
    }

    const { previousMonth, deltaPercentPoints } = data.saturationComparison;
    const previousMonthLabel = formatMonthLabel(previousMonth, language);
    const delta = Math.abs(deltaPercentPoints);

    if (deltaPercentPoints > 0) {
      return {
        icon: adminIcons.trendUp,
        iconClassName: "text-[var(--admin-success-text)]",
        iconTitle: t("monthsDetail.saturation.trend.up"),
        text: t("monthsDetail.saturation.comparison.more", {
          previousMonth: previousMonthLabel,
          delta,
        }),
      };
    }

    if (deltaPercentPoints < 0) {
      return {
        icon: adminIcons.trendDown,
        iconClassName: "text-[#b91c1c]!",
        iconTitle: t("monthsDetail.saturation.trend.down"),
        text: t("monthsDetail.saturation.comparison.less", {
          previousMonth: previousMonthLabel,
          delta,
        }),
      };
    }

    return {
      icon: adminIcons.trendNeutral,
      iconClassName: "text-[var(--admin-text-secondary)]",
      iconTitle: t("monthsDetail.saturation.trend.neutral"),
      text: t("monthsDetail.saturation.comparison.neutral"),
    };
  }, [data.saturationComparison, language, t]);

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
    dayAgendaModal.agenda,
    dayAgendaModal.editingAppointmentId,
    editDate,
    monthBaseSlots,
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
    const selectedDate = dayAgendaModal.selectedDate;
    const canCheckDayActions =
      dayAgendaModal.isOpen &&
      selectedDate !== null &&
      !dayAgendaModal.isLoadingAgenda &&
      !dayAgendaModal.agendaErrorCode &&
      selectedDate >= data.currentDate &&
      !hasFullDayBlockedEntry;

    if (!canCheckDayActions || !selectedDate) {
      setHasDayActionableSlots(false);
      setIsLoadingDayActionableSlots(false);
      return;
    }

    let isCancelled = false;
    setIsLoadingDayActionableSlots(true);

    void fetchAdminBlockableSlots(data.month, selectedDate)
      .then((response) => {
        if (isCancelled) {
          return;
        }

        const targetDay = response.days.find(
          (day) => day.date === selectedDate,
        );
        setHasDayActionableSlots(
          Boolean(targetDay && targetDay.slots.length > 0),
        );
      })
      .catch(() => {
        if (isCancelled) {
          return;
        }

        setHasDayActionableSlots(false);
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingDayActionableSlots(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    data.currentDate,
    data.month,
    dayAgendaModal.agenda,
    dayAgendaModal.agendaErrorCode,
    dayAgendaModal.isLoadingAgenda,
    dayAgendaModal.isOpen,
    dayAgendaModal.selectedDate,
    hasFullDayBlockedEntry,
  ]);

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
    blockedSlotIds: number[];
    reason: BlockReason;
    timeLabel: string;
  }) {
    const confirmed = window.confirm(
      t("monthsDetail.dayModal.blocked.confirmDelete.question", {
        time: input.timeLabel,
        reason: t(`monthsDetail.blockModal.reasons.${input.reason}`),
      }),
    );

    if (!confirmed) {
      return;
    }

    setProcessingBlockedSlotId(input.blockedSlotIds[0] ?? null);

    try {
      await sileo.promise(
        Promise.all(
          input.blockedSlotIds.map((blockedSlotId) =>
            deleteAdminBlockedSlotById({
              month: data.month,
              blockedSlotId,
            }),
          ),
        ),
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
        await Promise.all([
          refresh(),
          dayAgendaModal.isOpen ? dayAgendaModal.refresh() : Promise.resolve(),
        ]);
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

      await Promise.all([
        refresh(),
        dayAgendaModal.isOpen ? dayAgendaModal.refresh() : Promise.resolve(),
      ]);
    } catch {
      try {
        await bookAppointmentModal.refreshAvailability();
      } catch {
        // keep original error toast feedback
      }
    }
  }

  async function handleOpenBookAppointmentModal(initialDate?: string) {
    try {
      await bookAppointmentModal.open(initialDate);
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

  async function handleOpenBlockSpacesModal(initialDate?: string) {
    await blockSpacesModal.open(initialDate);
  }

  async function handleCopyMonthAgendaLink() {
    const result = await shareMonthAgenda(data.month);

    if (result === "cancelled") {
      return;
    }

    if (result === "copied") {
      sileo.success({
        title: t("monthsDetail.shareAgenda.notifications.copySuccess"),
      });
      return;
    }

    if (result === "shared") {
      sileo.success({
        title: t("monthsDetail.shareAgenda.notifications.shareSuccess"),
      });
      return;
    }

    sileo.error({
      title: t("monthsDetail.shareAgenda.notifications.copyError"),
    });
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
      ? "h-12 border-transparent bg-[rgba(239,68,68,0.18)]! text-[rgb(127,29,29)]! hover:brightness-95 focus-visible:outline-[rgb(127,29,29)]"
      : "h-12 border-transparent bg-[var(--admin-success-bg)]! text-[var(--admin-success-text)]! hover:brightness-95 focus-visible:outline-[var(--admin-success-text)]";
  const monthStatusToggleText =
    data.monthStatus === "ACTIVE"
      ? t("monthsDetail.monthStatus.actions.deactivate")
      : t("monthsDetail.monthStatus.actions.activate");
  const shouldShowActionButtons = !data.isPastMonth;
  const canSelectFullDay =
    blockSpacesModal.selectedDaySlots.length === monthBaseSlots.length &&
    monthBaseSlots.every((slot) =>
      blockSpacesModal.selectedDaySlots.includes(slot),
    );

  return (
    <main className="mx-auto flex w-full max-w-[412px] flex-col gap-4 px-3 py-4">
      <section className="flex items-start gap-2">
        <Link
          href="/admin/months"
          aria-label={t("monthsDetail.header.back")}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-accent)] transition hover:bg-[var(--admin-inactive-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)]"
        >
          <AdminIcon icon={adminIcons.back} />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h1 className="text-2xl font-bold text-[var(--admin-accent)]">
            {monthTitle}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${monthStatusTagClassName}`}
            >
              {monthStatusTagText}
            </span>
            {data.isPastMonth ? (
              <span className="rounded-full bg-[var(--admin-inactive-bg)] px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--admin-text-secondary)]">
                {t("monthsDetail.header.historical")}
              </span>
            ) : null}
          </div>
        </div>
        {!data.isPastMonth ? (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSlotModeDraft(data.slotMode);
              setIsSlotModeModalOpen(true);
            }}
            aria-label={t("monthsDetail.slotMode.openCta")}
            disabled={isLoading || isUpdatingSlotMode || isUpdatingMonthStatus}
            className="h-10 w-10 justify-center rounded-full p-0"
          >
            <AdminIcon icon={adminIcons.slotModeSettings} tone="secondary" />
          </Button>
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
          <h2 className="font-bold text-[var(--admin-text-primary)]">
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
        {saturationComparison ? (
          <p className="flex items-center gap-1.5 text-xs text-[var(--admin-text-secondary)]">
            <AdminIcon
              icon={saturationComparison.icon}
              className={saturationComparison.iconClassName}
              title={saturationComparison.iconTitle}
            />
            <span>{saturationComparison.text}</span>
          </p>
        ) : null}
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

            const day = cell.day;
            const isActionableDay = !day.isWeekend;
            const dayToneClasses = getToneClasses(
              day,
              day.date === data.currentDate,
            );

            return (
              <button
                type="button"
                key={cell.key}
                disabled={!isActionableDay}
                className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-lg border border-transparent text-sm font-semibold ${dayToneClasses} disabled:cursor-not-allowed disabled:opacity-75`}
                title={day.date}
                onClick={() => {
                  if (!isActionableDay) {
                    return;
                  }

                  void dayAgendaModal.open(day.date);
                }}
                aria-label={t("monthsDetail.dayModal.title", {
                  date: dayLabelFormatter.format(parseDateOnly(day.date)),
                })}
              >
                <span>{day.day}</span>
                {day.appointmentsCount && day.appointmentsCount > 0 ? (
                  <span
                    className="mt-0.5 flex items-center justify-center gap-0.5"
                    aria-hidden
                  >
                    {Array.from({
                      length: Math.min(day.appointmentsCount, 6),
                    }).map((_, index) => (
                      <span
                        key={`${day.date}-dot-${index}`}
                        data-testid={`${day.date}-appointment-dot`}
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

      {shouldShowActionButtons ? (
        <>
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
            onClick={() => void handleCopyMonthAgendaLink()}
            className="h-12"
          >
            <AdminIcon
              icon={adminIcons.shareAgenda}
              className="text-white! mr-2"
            />
            {t("monthsDetail.shareAgenda.openCta")}
          </Button>

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
            onClick={() => void handleOpenBlockSpacesModal()}
            className="h-12"
          >
            <AdminIcon
              icon={adminIcons.blockSpaces}
              className="text-white! mr-2"
            />
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
        </>
      ) : null}

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
                className={
                  slotModeDraft === "BLOCK_MODE" ? "text-white" : undefined
                }
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
                  slotModeDraft === "SECOND_ONLY_MODE"
                    ? "text-white"
                    : undefined
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
          dayBlockedEntries.length === 0 ? (
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

              {dayBlockedEntries.length > 0 ? (
                <>
                  <h3 className="pt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--admin-text-secondary)]">
                    {t("monthsDetail.dayModal.blocked.sectionTitle")}
                  </h3>
                  {dayBlockedEntries.map((blockedEntry) => {
                    const isFullDayEntry = blockedEntry.kind === "full-day";
                    const blockedSlotId = isFullDayEntry
                      ? (blockedEntry.blockedSlotIds[0] ?? -1)
                      : blockedEntry.blockedSlotId;
                    const canEditBlockedSlot =
                      !isFullDayEntry &&
                      isFutureDateTime(
                        blockedEntry.date,
                        blockedEntry.timeSlot.slice(0, 5),
                      );
                    const displayTime = isFullDayEntry
                      ? t("monthsDetail.dayModal.blocked.fullDayLabel")
                      : formatTimeSlotLabel(blockedEntry.timeSlot, language);

                    return (
                      <article
                        key={`blocked-${blockedSlotId}`}
                        className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 shadow-sm"
                      >
                        <div className="flex min-h-[72px] items-center gap-3">
                          <span className="w-20 text-left font-bold text-[var(--admin-accent)]">
                            {displayTime}
                          </span>
                          <div className="flex-1">
                            <p className="font-semibold text-[var(--admin-text-primary)]">
                              {t(
                                `monthsDetail.blockModal.reasons.${blockedEntry.reason}`,
                              )}
                            </p>
                            <p className="text-sm text-[var(--admin-text-secondary)]">
                              {t("monthsDetail.dayModal.blocked.subtitle")}
                            </p>
                          </div>
                          {processingBlockedSlotId === blockedSlotId ? (
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
                                    blockedSlotId,
                                    blockedEntry.reason,
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
                                    blockedSlotIds: isFullDayEntry
                                      ? blockedEntry.blockedSlotIds
                                      : [blockedSlotId],
                                    reason: blockedEntry.reason,
                                    timeLabel: displayTime,
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

                        {!isFullDayEntry &&
                        editingBlockedSlotId === blockedSlotId ? (
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
                                    blockedSlotId,
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

          {shouldShowDayActionButtons ? (
            <div className="grid grid-cols-1 gap-2">
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
                onClick={() =>
                  void handleOpenBookAppointmentModal(
                    dayAgendaModal.selectedDate ?? undefined,
                  )
                }
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
                disabled={
                  isLoading || isUpdatingSlotMode || isUpdatingMonthStatus
                }
                onClick={() =>
                  void handleOpenBlockSpacesModal(
                    dayAgendaModal.selectedDate ?? undefined,
                  )
                }
                className="h-12"
              >
                <AdminIcon
                  icon={adminIcons.blockSpaces}
                  className="text-white! mr-2"
                />
                {t("monthsDetail.blockModal.openCta")}
              </Button>
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
        isFullDaySelected={blockSpacesModal.isFullDaySelected}
        canSelectFullDay={canSelectFullDay}
        areAllSelectedForDay={blockSpacesModal.areAllSelectedForDay}
        reason={blockSpacesModal.reason}
        allowBlockView={data.slotMode === "BLOCK_MODE"}
        slotViewMode={blockSpacesModal.slotViewMode}
        onClose={blockSpacesModal.close}
        onRetry={() => void handleOpenBlockSpacesModal()}
        onSelectDate={blockSpacesModal.selectDate}
        onToggleSlot={blockSpacesModal.toggleSlot}
        onToggleBlockSlots={blockSpacesModal.toggleBlockSlots}
        onSelectAllSlots={blockSpacesModal.selectAllSlotsForDay}
        onSelectFullDay={blockSpacesModal.selectFullDayForDay}
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
        newClientNumber={bookAppointmentModal.newClientNumber}
        successResult={bookAppointmentModal.successResult}
        onClose={bookAppointmentModal.close}
        onSelectDate={bookAppointmentModal.selectDate}
        onSelectTimeSlot={bookAppointmentModal.selectTimeSlot}
        onChangeClientMode={bookAppointmentModal.changeClientMode}
        onSearchQueryChange={bookAppointmentModal.setSearchQuery}
        onSelectClient={bookAppointmentModal.selectClient}
        onNewClientNameChange={bookAppointmentModal.setNewClientName}
        onNewClientPhoneChange={bookAppointmentModal.setNewClientPhone}
        onNewClientNumberChange={bookAppointmentModal.setNewClientNumber}
        onSubmit={() => void handleCreateAdminAppointment()}
        onBackFromSuccess={() => void handleBackFromBookingSuccess()}
      />
    </main>
  );
}
