"use client";

import { useState } from "react";
import type { TFunction } from "i18next";
import { sileo } from "sileo";

import {
  formatTimeSlotLabel,
  parseDateOnly,
} from "@/lib/datetime/mexico-city";
import { REQUIRED_TIMEZONE } from "@/lib/constants/slots";
import { buildWhatsappUrlFromMessage } from "@/lib/whatsapp/message";
import type {
  DashboardReminderItem,
  DashboardReminderType,
} from "@/lib/admin/dashboard/types";
import type { AppLanguage } from "@/lib/i18n/config";

function resolveLocale(language: AppLanguage) {
  return language === "en" ? "en-US" : "es-MX";
}

function resolveWeekday(date: string, language: AppLanguage) {
  const locale = resolveLocale(language);
  return new Intl.DateTimeFormat(locale, {
    timeZone: REQUIRED_TIMEZONE,
    weekday: "long",
  }).format(parseDateOnly(date));
}

function resolveDayAndMonth(date: string, language: AppLanguage) {
  const locale = resolveLocale(language);
  const parsedDate = parseDateOnly(date);

  const day = new Intl.DateTimeFormat(locale, {
    timeZone: REQUIRED_TIMEZONE,
    day: "numeric",
  }).format(parsedDate);

  const month = new Intl.DateTimeFormat(locale, {
    timeZone: REQUIRED_TIMEZONE,
    month: "long",
  }).format(parsedDate);

  return { day, month };
}

async function trackReminder(
  appointmentId: number,
  payload: {
    reminderType: DashboardReminderType;
    targetPhone: string;
    message: string;
  },
) {
  const response = await fetch(
    `/api/admin/appointments/${appointmentId}/reminders`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
  );

  const body = (await response.json().catch(() => ({}))) as {
    errorCode?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(body.errorCode ?? body.error ?? "UNKNOWN_ERROR");
  }
}

type UseReminderAppointmentsInput = {
  language: AppLanguage;
  t: TFunction<"admin">;
};

export function useReminderAppointments({
  language,
  t,
}: UseReminderAppointmentsInput) {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [activeTooltipKey, setActiveTooltipKey] = useState<string | null>(null);

  async function sendReminder(item: DashboardReminderItem) {
    const busyId = `${item.appointmentId}:${item.reminderType}`;

    setBusyKey(busyId);

    const timeLabel = formatTimeSlotLabel(item.timeSlot, language);
    const weekday = resolveWeekday(item.date, language);
    const { day, month } = resolveDayAndMonth(item.date, language);
    const message = t(
      item.reminderType === "NEXT_DAY"
        ? "dashboard.reminders.whatsapp.nextDayMessage"
        : "dashboard.reminders.whatsapp.nextWeekMessage",
      {
        name: item.name,
        time: timeLabel,
        weekday,
        day,
        month,
      },
    );

    const whatsappUrl = buildWhatsappUrlFromMessage({
      phone: `52${item.phone}`,
      message,
    });

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");

    try {
      await trackReminder(item.appointmentId, {
        reminderType: item.reminderType,
        targetPhone: item.phone,
        message,
      });

      sileo.success({
        title: t("dashboard.reminders.notifications.sentTitle"),
        description: t("dashboard.reminders.notifications.sentDescription", {
          name: item.name,
        }),
      });
    } catch (error) {
      const errorCode =
        error instanceof Error ? error.message : "UNKNOWN_ERROR";

      if (errorCode === "APPOINTMENT_REMINDER_ALREADY_SENT") {
        sileo.warning({
          title: t("dashboard.reminders.notifications.alreadySentTitle"),
          description: t(
            "dashboard.reminders.notifications.alreadySentDescription",
          ),
        });
        return;
      }

      if (errorCode === "ADMIN_UNAUTHORIZED") {
        sileo.error({
          title: t("dashboard.reminders.notifications.unauthorizedTitle"),
          description: t(
            "dashboard.reminders.notifications.unauthorizedDescription",
          ),
        });
        return;
      }

      sileo.error({
        title: t("dashboard.reminders.notifications.errorTitle"),
        description: t("dashboard.reminders.notifications.errorDescription"),
      });
    } finally {
      setBusyKey(null);
    }
  }

  function showAlreadySentTooltip(reminderKey: string) {
    setActiveTooltipKey(reminderKey);
    window.setTimeout(() => {
      setActiveTooltipKey((current) =>
        current === reminderKey ? null : current,
      );
    }, 1800);
  }

  return {
    activeTooltipKey,
    busyKey,
    sendReminder,
    showAlreadySentTooltip,
  };
}
