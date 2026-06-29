import { NextResponse } from "next/server";

import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";
import { cancelMyAppointments } from "@/lib/my-appointments/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      phone: string;
      appointmentIds: number[];
    };

    const response = await cancelMyAppointments(payload);
    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);
    const status = errorCode === "APPOINTMENT_NOT_FOUND" ? 404 : 400;

    return NextResponse.json(buildErrorPayload(errorCode), { status });
  }
}
