import { NextResponse } from "next/server";

import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";
import { confirmAppointmentWithLock } from "@/lib/appointments/book-appointment";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      name?: string;
      phone: string;
      date: string;
      timeSlot: string;
      lockToken: string;
      appointmentIdToReschedule?: number;
    };

    const response = await confirmAppointmentWithLock(payload);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const errorCode = normalizeErrorCode(error);
    const status =
      errorCode === "SLOT_NOT_AVAILABLE" ||
      errorCode === "PHONE_ALREADY_BOOKED" ||
      errorCode === "LOCK_TIMEOUT" ||
      errorCode === "LOCK_EXPIRED_OR_INVALID" ||
      errorCode === "CLIENT_NAME_MISMATCH" ||
      errorCode === "APPOINTMENT_NOT_FOUND"
        ? 409
        : 400;

    return NextResponse.json(buildErrorPayload(errorCode), { status });
  }
}
