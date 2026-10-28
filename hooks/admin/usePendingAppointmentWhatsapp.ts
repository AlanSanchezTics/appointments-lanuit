"use client";

import type { TFunction } from "i18next";

import {
  formatLongDate,
  formatTimeSlotLabel,
} from "@/lib/datetime/mexico-city";
import { buildWhatsappUrlFromMessage } from "@/lib/whatsapp/message";
import type { AdminPendingAppointmentItem } from "@/lib/admin/appointments/types";
import type { AppLanguage } from "@/lib/i18n/config";

type UsePendingAppointmentWhatsappInput = {
  language: AppLanguage;
  t: TFunction<"admin">;
};

export function usePendingAppointmentWhatsapp({
  language,
  t,
}: UsePendingAppointmentWhatsappInput) {
  // Same-tab redirect: mobile browsers block window.open outside a direct gesture.
  function redirectToConfirmationWhatsapp(item: AdminPendingAppointmentItem) {
    const message = t("dashboard.pendingAppointments.whatsappMessage", {
      date: formatLongDate(item.date, language),
      time: formatTimeSlotLabel(item.timeSlot, language),
    });

    window.location.assign(
      buildWhatsappUrlFromMessage({
        phone: `52${item.phone}`,
        message,
      }),
    );
  }

  return {
    redirectToConfirmationWhatsapp,
  };
}
