import type {
  MyAppointmentsCancelResult,
  MyAppointmentsLookupResult,
  MyAppointmentsRescheduleResult,
} from "@/lib/my-appointments/types";

type ApiErrorPayload = {
  error?: string;
  errorCode?: string;
};

function toErrorCode(payload: ApiErrorPayload, fallback = "UNKNOWN_ERROR") {
  return payload.errorCode ?? payload.error ?? fallback;
}

export async function lookupMyAppointments(phone: string) {
  const response = await fetch("/api/my-appointments/lookup", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone }),
  });

  const payload = (await response.json()) as MyAppointmentsLookupResult &
    ApiErrorPayload;

  if (!response.ok) {
    throw new Error(toErrorCode(payload));
  }

  return payload;
}

export async function cancelMyAppointments(input: {
  phone: string;
  appointmentIds: number[];
}) {
  const response = await fetch("/api/my-appointments/cancel", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as MyAppointmentsCancelResult &
    ApiErrorPayload;

  if (!response.ok) {
    throw new Error(toErrorCode(payload));
  }

  return payload;
}

export async function rescheduleMyAppointment(input: {
  phone: string;
  appointmentId: number;
  month: string;
  date: string;
  timeSlot: string;
}) {
  const response = await fetch("/api/my-appointments/reschedule", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as MyAppointmentsRescheduleResult &
    ApiErrorPayload;

  if (!response.ok) {
    throw new Error(toErrorCode(payload));
  }

  return payload;
}
