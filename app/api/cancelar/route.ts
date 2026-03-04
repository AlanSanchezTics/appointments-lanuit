import { NextResponse } from "next/server";

import { cancelAppointment } from "@/lib/appointments/cancel-appointment";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      phone: string;
    };

    const response = await cancelAppointment(payload);
    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "APPOINTMENT_NOT_FOUND" ? 404 : 400;

    return NextResponse.json({ error: message }, { status });
  }
}
