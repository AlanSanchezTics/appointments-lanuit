import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { trackAdminAppointmentReminder } from "@/lib/admin/appointments/service";
import { parseAppointmentIdParam } from "@/lib/admin/appointments/validation";
import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminReminderRouteProps = {
  params: Promise<{
    appointmentId: string;
  }>;
};

const REMINDER_PAYLOAD_SCHEMA = z.object({
  reminderType: z.enum(["NEXT_DAY", "NEXT_WEEK"]),
  targetPhone: z.string().trim().regex(/^\d{10}$/, "TARGET_PHONE_INVALID"),
  message: z.string().trim().min(1, "MESSAGE_REQUIRED"),
});

function resolveStatusCode(errorCode: string) {
  if (errorCode === "APPOINTMENT_NOT_FOUND") {
    return 404;
  }

  if (errorCode === "APPOINTMENT_REMINDER_ALREADY_SENT") {
    return 409;
  }

  return 400;
}

function resolveAdminId(rawId: unknown) {
  if (typeof rawId !== "string" || !/^\d+$/.test(rawId)) {
    return null;
  }

  const parsed = Number(rawId);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function POST(request: Request, { params }: AdminReminderRouteProps) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(buildErrorPayload("ADMIN_UNAUTHORIZED"), {
      status: 401,
    });
  }

  try {
    const { appointmentId: rawAppointmentId } = await params;
    const appointmentId = parseAppointmentIdParam(rawAppointmentId);
    const payload = REMINDER_PAYLOAD_SCHEMA.parse(await request.json());
    const response = await trackAdminAppointmentReminder(appointmentId, {
      ...payload,
      sentByAdminUserId: resolveAdminId(session.user?.id),
    });

    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);

    return NextResponse.json(buildErrorPayload(errorCode), {
      status: resolveStatusCode(errorCode),
    });
  }
}
