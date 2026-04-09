import { useMemo } from "react";

import type { CancelableAppointment } from "@/lib/cancel/types";
import {
  formatLongDate,
  formatTimeSlotLabel,
  toDateTime,
} from "@/lib/datetime/mexico-city";
import type { AppLanguage } from "@/lib/i18n/config";
import {
  buildWhatsappUrlFromMessage,
  getWhatsappPhone,
} from "@/lib/whatsapp/message";

type TranslateFn = (
  key: string,
  options?: Record<string, string | number | undefined>,
) => string;

type UseCancelSuccessWhatsappParams = {
  appointments: CancelableAppointment[];
  language: AppLanguage;
  selectedAppointmentIds: number[];
  translate: TranslateFn;
};

export function useCancelSuccessWhatsapp({
  appointments,
  language,
  selectedAppointmentIds,
  translate,
}: UseCancelSuccessWhatsappParams) {
  const whatsappUrl = useMemo(() => {
    const selectedAppointments = appointments.filter((appointment) =>
      selectedAppointmentIds.includes(appointment.appointmentId),
    );

    if (selectedAppointments.length === 0) {
      return null;
    }

    const [primaryAppointment] = selectedAppointments.sort((a, b) =>
      toDateTime(a.date, a.timeSlot).localeCompare(toDateTime(b.date, b.timeSlot)),
    );

    const formattedDate = formatLongDate(primaryAppointment.date, language);
    const formattedTime = formatTimeSlotLabel(primaryAppointment.timeSlot, language);
    const message = translate("whatsapp.cancelMessageTemplate", {
      date: formattedDate,
      time: formattedTime,
    });
    const whatsappPhone = getWhatsappPhone();

    return buildWhatsappUrlFromMessage({
      phone: whatsappPhone,
      message,
    });
  }, [appointments, language, selectedAppointmentIds, translate]);

  return {
    whatsappUrl,
  };
}
