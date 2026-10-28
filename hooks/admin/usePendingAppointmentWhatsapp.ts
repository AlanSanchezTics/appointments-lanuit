"use client";

import type { TFunction } from "i18next";
import { sileo } from "sileo";

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
  // Offer only: nothing opens until the admin taps the toast button. The URL is
  // built here, before the dashboard refresh unmounts the card.
  function offerConfirmationWhatsapp(item: AdminPendingAppointmentItem) {
    const message = t("dashboard.pendingAppointments.whatsappMessage", {
      date: formatLongDate(item.date, language),
      time: formatTimeSlotLabel(item.timeSlot, language),
    });
    const whatsappUrl = buildWhatsappUrlFromMessage({
      phone: `52${item.phone}`,
      message,
    });

    sileo.action({
      title: t("dashboard.pendingAppointments.notifications.whatsappActionTitle"),
      button: {
        title: t("dashboard.pendingAppointments.notifications.whatsappActionButton"),
        // Same tab, synchronous inside the click: mobile browsers block window.open outside a gesture.
        onClick: () => window.location.assign(whatsappUrl),
      },
    });
  }

  return {
    offerConfirmationWhatsapp,
  };
}
