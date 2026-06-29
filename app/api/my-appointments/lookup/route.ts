import { NextResponse } from "next/server";

import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";
import { findMyAppointments } from "@/lib/my-appointments/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      phone: string;
    };

    const response = await findMyAppointments(payload);
    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);
    const status = errorCode === "APPOINTMENT_NOT_FOUND" ? 404 : 400;

    return NextResponse.json(buildErrorPayload(errorCode), { status });
  }
}
