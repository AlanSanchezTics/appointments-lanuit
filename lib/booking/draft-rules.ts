import type { DayAvailability } from "@/lib/availability/service";
import type { BookingDraft, BookingValidationErrors } from "@/lib/booking/types";

export function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export function validateDraft(
  draft: BookingDraft,
  requiresName: boolean,
): BookingValidationErrors {
  const nextErrors: BookingValidationErrors = {};

  if (!draft.date) {
    nextErrors.date = "DATE_REQUIRED";
  }

  if (!draft.timeSlot) {
    nextErrors.timeSlot = "TIME_SLOT_REQUIRED";
  }

  if (!/^[0-9]{10}$/.test(normalizePhone(draft.phone))) {
    nextErrors.phone = "PHONE_INVALID";
  }

  if (requiresName && draft.name.trim().length < 3) {
    nextErrors.name = "NAME_REQUIRED";
  }

  if (nextErrors.date || nextErrors.timeSlot) {
    nextErrors.form = "FORM_INCOMPLETE";
  }

  return nextErrors;
}

export function validateScheduleDraft(
  draft: BookingDraft,
): BookingValidationErrors {
  const nextErrors: BookingValidationErrors = {};

  if (!draft.date) {
    nextErrors.date = "DATE_REQUIRED";
  }

  if (!draft.timeSlot) {
    nextErrors.timeSlot = "TIME_SLOT_REQUIRED";
  }

  if (nextErrors.date || nextErrors.timeSlot) {
    nextErrors.form = "FORM_INCOMPLETE";
  }

  return nextErrors;
}

export function validateIdentityDraft(
  draft: BookingDraft,
  requiresName: boolean,
): BookingValidationErrors {
  const nextErrors: BookingValidationErrors = {};

  if (!/^[0-9]{10}$/.test(normalizePhone(draft.phone))) {
    nextErrors.phone = "PHONE_INVALID";
  }

  if (requiresName && draft.name.trim().length < 3) {
    nextErrors.name = "NAME_REQUIRED";
  }

  return nextErrors;
}

export function normalizeDraftByAvailability(
  draft: BookingDraft,
  days: DayAvailability[],
): BookingDraft {
  if (draft.date === null && draft.timeSlot === null) {
    return draft;
  }

  if (days.length === 0) {
    return {
      ...draft,
      date: null,
      timeSlot: null,
    };
  }

  const selectedDay =
    days.find((day) => day.date === draft.date) ?? days[0] ?? null;

  if (!selectedDay) {
    return {
      ...draft,
      date: null,
      timeSlot: null,
    };
  }

  const nextTimeSlot = selectedDay.slots.includes(draft.timeSlot ?? "")
    ? draft.timeSlot
    : (selectedDay.slots[0] ?? null);

  return {
    ...draft,
    date: selectedDay.date,
    timeSlot: nextTimeSlot,
  };
}

export function getInitialDraftField<K extends keyof BookingDraft>(
  initialDraft: Partial<BookingDraft> | undefined,
  key: K,
  fallback: BookingDraft[K],
) {
  if (initialDraft && key in initialDraft) {
    return initialDraft[key] as BookingDraft[K];
  }

  return fallback;
}
