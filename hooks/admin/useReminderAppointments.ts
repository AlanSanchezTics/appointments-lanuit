"use client";

import type { TFunction } from "i18next";

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

type UseReminderAppointmentsInput = {
  language: AppLanguage;
  t: TFunction<"admin">;
};

export function useReminderAppointments({
  language,
  t,
}: UseReminderAppointmentsInput) {
  async function sendReminder(item: DashboardReminderItem) {
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

    window.location.assign(whatsappUrl);
  }

  return {
    sendReminder,
  };
}
