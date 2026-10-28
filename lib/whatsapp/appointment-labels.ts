import { formatLongDate, formatTimeSlotLabel } from "@/lib/datetime/mexico-city";
import type { AppLanguage } from "@/lib/i18n/config";

// Date and time labels for WhatsApp messages about an appointment; callers own the message template.
export function formatWhatsappAppointmentLabels(input: {
  date: string;
  timeSlot: string;
  language: AppLanguage;
}) {
  return {
    date: formatLongDate(input.date, input.language),
    time: formatTimeSlotLabel(input.timeSlot, input.language).toLowerCase(),
  };
}
