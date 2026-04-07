import type { DayAvailability } from "@/lib/availability/service";
import type {
  BookingDraft,
  BookingSuccess,
  ClientCheckLockResult,
} from "@/lib/booking/types";
import { normalizeClientName } from "@/lib/shared/client-name";

type ApiErrorPayload = {
  error?: string;
  errorCode?: string;
};

function toErrorCode(payload: ApiErrorPayload, fallback = "UNKNOWN_ERROR") {
  return payload.errorCode ?? payload.error ?? fallback;
}

export async function checkClientAndAcquireReservationLock(draft: BookingDraft) {
  const response = await fetch("/api/reservar/client-check-lock", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone: draft.phone,
      date: draft.date,
      timeSlot: draft.timeSlot,
    }),
  });

  const payload = (await response.json()) as ClientCheckLockResult &
    ApiErrorPayload;

  if (!response.ok) {
    throw new Error(toErrorCode(payload));
  }

  return payload;
}

export async function releaseReservationLock(lockToken: string) {
  await fetch("/api/reservar/lock", {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ lockToken }),
  });
}

export async function submitBookingDraft(
  draft: BookingDraft,
  lockToken: string,
  appointmentIdToReschedule?: number | null,
) {
  const normalizedName = normalizeClientName(draft.name);

  const response = await fetch("/api/reservar/confirm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: normalizedName,
      phone: draft.phone,
      date: draft.date,
      timeSlot: draft.timeSlot,
      lockToken,
      appointmentIdToReschedule: appointmentIdToReschedule ?? undefined,
    }),
  });

  const payload = (await response.json()) as BookingSuccess & ApiErrorPayload;

  if (!response.ok) {
    throw new Error(toErrorCode(payload));
  }

  return payload;
}

export async function fetchMonthAvailability(month: string) {
  const response = await fetch(`/api/availability/${month}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("AVAILABILITY_REFRESH_FAILED");
  }

  const payload = (await response.json()) as {
    days?: DayAvailability[];
  };

  return payload.days ?? [];
}
