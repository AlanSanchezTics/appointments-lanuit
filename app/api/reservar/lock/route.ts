import { NextResponse } from "next/server";

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
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      message === "SLOT_NOT_AVAILABLE" ||
      message === "PHONE_ALREADY_BOOKED" ||
      message === "LOCK_TIMEOUT" ||
      message === "SLOT_LOCKED"
        ? 409
        : 400;

    return NextResponse.json({ error: message }, { status });
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
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
