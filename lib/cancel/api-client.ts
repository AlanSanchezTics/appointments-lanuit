import type {
  CancelableAppointmentLookupResult,
  CancellationResult,
} from "@/lib/cancel/types";

type ApiErrorPayload = {
  error?: string;
  errorCode?: string;
};

function toErrorCode(payload: ApiErrorPayload, fallback = "UNKNOWN_ERROR") {
  return payload.errorCode ?? payload.error ?? fallback;
}

export async function lookupCancelableAppointment(phone: string) {
  const response = await fetch("/api/cancelar/buscar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ phone }),
  });

  const payload = (await response.json()) as CancelableAppointmentLookupResult &
    ApiErrorPayload;

  if (!response.ok) {
    throw new Error(toErrorCode(payload));
  }

  return payload;
}

export async function submitCancellation(input: {
  phone: string;
  appointmentIds: number[];
}) {
  const response = await fetch("/api/cancelar", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  const payload = (await response.json()) as CancellationResult & ApiErrorPayload;

  if (!response.ok) {
    throw new Error(toErrorCode(payload));
  }

  return payload;
}
