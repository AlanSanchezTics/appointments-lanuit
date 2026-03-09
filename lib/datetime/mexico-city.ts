import { REQUIRED_TIMEZONE } from "@/lib/constants/slots";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: REQUIRED_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const monthFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: REQUIRED_TIMEZONE,
  year: "numeric",
  month: "2-digit",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: REQUIRED_TIMEZONE,
  weekday: "short",
});

const longDateFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: REQUIRED_TIMEZONE,
  dateStyle: "long",
});

const monthLabelFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: REQUIRED_TIMEZONE,
  month: "long",
  year: "numeric",
});

const shortWeekdayLabelFormatter = new Intl.DateTimeFormat("es-MX", {
  timeZone: REQUIRED_TIMEZONE,
  weekday: "short",
});

const dayLabelFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: REQUIRED_TIMEZONE,
  day: "2-digit",
});

export function getCurrentMonthKey(now = new Date()) {
  return monthFormatter.format(now);
}

export function getCurrentDateKey(now = new Date()) {
  return dateFormatter.format(now);
}

export function isCurrentMonth(month: string, now = new Date()) {
  return month === getCurrentMonthKey(now);
}

export function isFutureDate(date: string, now = new Date()) {
  return date > getCurrentDateKey(now);
}

export function isWeekdayInMexicoCity(date: string) {
  const weekday = weekdayFormatter.format(parseDateOnly(date));
  return weekday !== "Sat" && weekday !== "Sun";
}

export function formatLongDate(date: string) {
  return longDateFormatter.format(parseDateOnly(date));
}

export function formatMonthLabel(month: string) {
  return capitalize(monthLabelFormatter.format(parseDateOnly(`${month}-01`)));
}

export function formatShortWeekdayLabel(date: string) {
  return shortWeekdayLabelFormatter
    .format(parseDateOnly(date))
    .replace(".", "")
    .slice(0, 3)
    .toUpperCase();
}

export function formatDayOfMonthLabel(date: string) {
  return dayLabelFormatter.format(parseDateOnly(date));
}

export function formatTimeSlotLabel(timeSlot: string) {
  const { hour, minute } = parseTimeSlot(timeSlot);
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;

  return `${normalizedHour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")} ${suffix}`;
}

export function parseDateOnly(date: string) {
  return new Date(`${date}T12:00:00.000Z`);
}

export function parseTimeSlot(timeSlot: string) {
  const [hour, minute] = timeSlot.split(":").map(Number);

  return { hour, minute };
}

export function toDateTime(date: string, timeSlot: string) {
  return `${date}T${timeSlot}:00`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
