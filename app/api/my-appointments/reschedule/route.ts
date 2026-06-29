import { NextResponse } from "next/server";

import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";
import { rescheduleMyAppointment } from "@/lib/my-appointments/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      phone: string;
      appointmentId: number;
      month: string;
      date: string;
      timeSlot: string;
    };

    const response = await rescheduleMyAppointment(payload);
    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);
    const status =
      errorCode === "APPOINTMENT_NOT_FOUND"
      || errorCode === "APPOINTMENT_NOT_MODIFIABLE"
      || errorCode === "SLOT_NOT_AVAILABLE"
        ? 409
        : 400;

    return NextResponse.json(buildErrorPayload(errorCode), { status });
  }
}
