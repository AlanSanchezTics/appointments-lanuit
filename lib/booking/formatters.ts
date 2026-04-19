import type { DayAvailability } from "@/lib/availability/service";

export function formatRemainingTime(remainingSeconds: number) {
  const safeSeconds = Math.max(0, remainingSeconds);
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatPhoneForDisplay(phone: string) {
  const trimmed = phone.replace(/\D/g, "");

  if (trimmed.length !== 10) {
    return phone;
  }

  return `${trimmed.slice(0, 3)} ${trimmed.slice(3, 6)} ${trimmed.slice(6)}`;
}

export function getHighlightedDays(
  days: DayAvailability[],
  selectedDate: string | null,
) {
  if (days.length <= 4) {
    return days;
  }

  const selectedIndex = Math.max(
    0,
    selectedDate ? days.findIndex((day) => day.date === selectedDate) : 0,
  );
  const start = Math.min(
    Math.max(selectedIndex - 1, 0),
    Math.max(days.length - 4, 0),
  );

  return days.slice(start, start + 4);
}

export function formatAccountNumberForDisplay(accountNumber: string) {
  const trimmed = accountNumber.replace(/\D/g, "");

  if (trimmed.length !== 16) {
    return accountNumber;
  }

  return `${trimmed.slice(0, 4)} ${trimmed.slice(4, 8)} ${trimmed.slice(
    8,
    12,
  )} ${trimmed.slice(12)}`;
}
