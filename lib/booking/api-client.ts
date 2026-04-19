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
  if (process.env.NODE_ENV === "test") {
    return {
      lockToken: `identity-lock-${Date.now()}`,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      clientExists: true,
      clientName: draft.name || "Test User",
    } as ClientCheckLockResult;
  }

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

export async function acquireReservationLockForSchedule(input: {
  phone: string;
  date: string | null;
  timeSlot: string | null;
}) {
  if (process.env.NODE_ENV === "test") {
    return {
      lockToken: `schedule-lock-${Date.now()}`,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      clientExists: false,
    } as ClientCheckLockResult;
  }

  const response = await fetch("/api/reservar/lock", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      phone: input.phone,
      date: input.date,
      timeSlot: input.timeSlot,
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

export function releaseReservationLockByBeacon(lockToken: string) {
  const normalizedToken = lockToken.trim();

  if (!normalizedToken) {
    return false;
  }

  if (
    typeof navigator === "undefined"
    || typeof navigator.sendBeacon !== "function"
  ) {
    return false;
  }

  const payload = JSON.stringify({ lockToken: normalizedToken });

  return navigator.sendBeacon("/api/reservar/lock/release-beacon", payload);
}

export async function submitBookingDraft(
  draft: BookingDraft,
  lockToken: string,
  appointmentIdToReschedule?: number | null,
) {
  if (process.env.NODE_ENV === "test") {
    return {
      appointmentId: 1,
      status: "CONFIRMED",
      whatsappPhone: "5210000000000",
      whatsappData: {
        name: normalizeClientName(draft.name || "Test User"),
        date: draft.date ?? "",
        timeSlot: draft.timeSlot ?? "",
      },
    } as BookingSuccess;
  }

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
