import { NextResponse } from "next/server";

import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";
import { cancelAppointment } from "@/lib/appointments/cancel-appointment";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      phone: string;
      appointmentId: number;
    };

    const response = await cancelAppointment(payload);
    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);
    const status = errorCode === "APPOINTMENT_NOT_FOUND" ? 404 : 400;

    return NextResponse.json(buildErrorPayload(errorCode), { status });
  }
}
