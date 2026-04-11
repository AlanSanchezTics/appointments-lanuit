import { NextResponse } from "next/server";

import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";
import { releaseReservationSlotLock } from "@/lib/appointments/lock-reservation-slot";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      lockToken: string;
    };

    const response = await releaseReservationSlotLock(payload);
    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    const errorCode = normalizeErrorCode(error);
    return NextResponse.json(buildErrorPayload(errorCode), { status: 400 });
  }
}
