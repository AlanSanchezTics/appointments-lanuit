import { NextResponse } from "next/server";

import { confirmAppointmentWithLock } from "@/lib/appointments/book-appointment";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      name: string;
      phone: string;
      date: string;
      timeSlot: string;
      lockToken: string;
    };

    const response = await confirmAppointmentWithLock(payload);
    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status =
      message === "SLOT_NOT_AVAILABLE" ||
      message === "PHONE_ALREADY_BOOKED" ||
      message === "LOCK_TIMEOUT" ||
      message === "LOCK_EXPIRED_OR_INVALID"
        ? 409
        : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
