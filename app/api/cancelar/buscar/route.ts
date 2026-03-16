import { NextResponse } from "next/server";

import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";
import { findCancelableAppointment } from "@/lib/appointments/find-cancelable-appointment";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      phone: string;
    };

    const response = await findCancelableAppointment(payload);
    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);
    const status = errorCode === "APPOINTMENT_NOT_FOUND" ? 404 : 400;

    return NextResponse.json(buildErrorPayload(errorCode), { status });
  }
}
