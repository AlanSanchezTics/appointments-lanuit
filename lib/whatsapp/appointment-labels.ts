import { formatTimeSlotLabel, parseDateOnly } from "@/lib/datetime/mexico-city";
import type { AppLanguage } from "@/lib/i18n/config";

function capitalizeFirst(value: string) {
  return value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;
}

// Date and time labels for WhatsApp messages about an appointment; callers own the message template.
export function formatWhatsappAppointmentLabels(input: {
  date: string;
  timeSlot: string;
  language: AppLanguage;
}) {
  const locale = input.language === "en" ? "en-US" : "es-MX";

  const date = new Intl.DateTimeFormat(locale, {
    timeZone: "America/Mexico_City",
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .formatToParts(parseDateOnly(input.date))
    .map((part) =>
      part.type === "weekday" || part.type === "month"
        ? capitalizeFirst(part.value)
        : part.value,
    )
    .join("");

  return {
    date,
    time: formatTimeSlotLabel(input.timeSlot, input.language).toLowerCase(),
  };
}
