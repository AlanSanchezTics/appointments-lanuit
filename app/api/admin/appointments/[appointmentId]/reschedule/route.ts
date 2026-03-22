import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { rescheduleAdminAppointment } from "@/lib/admin/appointments/service";
import {
  parseAdminReschedulePayload,
  parseAppointmentIdParam,
} from "@/lib/admin/appointments/validation";
import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminRescheduleRouteProps = {
  params: Promise<{
    appointmentId: string;
  }>;
};

function resolveStatusCode(errorCode: string) {
  if (errorCode === "MONTH_NOT_REGISTERED" || errorCode === "APPOINTMENT_NOT_FOUND") {
    return 404;
  }

  if (errorCode === "SLOT_NOT_AVAILABLE" || errorCode === "SLOT_LOCKED") {
    return 409;
  }

  return 400;
}

export async function PATCH(request: Request, { params }: AdminRescheduleRouteProps) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(buildErrorPayload("ADMIN_UNAUTHORIZED"), {
      status: 401,
    });
  }

  try {
    const { appointmentId: rawAppointmentId } = await params;
    const appointmentId = parseAppointmentIdParam(rawAppointmentId);
    const payload = parseAdminReschedulePayload(await request.json());
    const response = await rescheduleAdminAppointment(appointmentId, payload);

    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);

    return NextResponse.json(buildErrorPayload(errorCode), {
      status: resolveStatusCode(errorCode),
    });
  }
}
