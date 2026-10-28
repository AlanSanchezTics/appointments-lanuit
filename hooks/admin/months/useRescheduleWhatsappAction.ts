"use client";

import { useTranslation } from "react-i18next";
import { sileo } from "sileo";

import { formatWhatsappAppointmentLabels } from "@/lib/whatsapp/appointment-labels";
import { buildWhatsappUrlFromMessage } from "@/lib/whatsapp/message";

type OfferRescheduleWhatsappInput = {
  phone: string;
  date: string;
  timeSlot: string;
};

export function useRescheduleWhatsappAction() {
  const { t, i18n } = useTranslation("admin");
  const language = i18n.resolvedLanguage === "en" ? "en" : "es";

  function offerRescheduleWhatsapp({
    phone,
    date,
    timeSlot,
  }: OfferRescheduleWhatsappInput) {
    const message = t(
      "monthsDetail.bookModal.success.whatsappMessage",
      formatWhatsappAppointmentLabels({ date, timeSlot, language }),
    );
    // Same wa.me convention as the reminder flow: country code 52 + 10-digit phone.
    const whatsappUrl = buildWhatsappUrlFromMessage({
      phone: `52${phone}`,
      message,
    });

    sileo.action({
      title: t("monthsDetail.dayModal.notifications.whatsappActionTitle"),
      button: {
        title: t("monthsDetail.dayModal.notifications.whatsappActionButton"),
        onClick: () => window.location.assign(whatsappUrl),
      },
    });
  }

  return { offerRescheduleWhatsapp };
}
