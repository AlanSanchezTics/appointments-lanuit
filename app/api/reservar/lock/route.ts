import { NextResponse } from "next/server";

import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";
import { acquireReservationSlotLock, releaseReservationSlotLock } from "@/lib/appointments/lock-reservation-slot";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      phone: string;
      date: string;
      timeSlot: string;
    };

    const response = await acquireReservationSlotLock(payload);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const errorCode = normalizeErrorCode(error);
    const status =
      errorCode === "SLOT_NOT_AVAILABLE" ||
      errorCode === "PHONE_ALREADY_BOOKED" ||
      errorCode === "LOCK_TIMEOUT" ||
      errorCode === "SLOT_LOCKED"
        ? 409
        : 400;

    return NextResponse.json(buildErrorPayload(errorCode), { status });
  }
}

export async function DELETE(request: Request) {
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
