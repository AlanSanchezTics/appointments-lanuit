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
