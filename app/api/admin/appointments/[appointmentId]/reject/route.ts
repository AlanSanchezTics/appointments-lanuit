import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { rejectPendingAppointment } from "@/lib/admin/appointments/service";
import { parseAppointmentIdParam } from "@/lib/admin/appointments/validation";
import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminRejectRouteProps = {
  params: Promise<{
    appointmentId: string;
  }>;
};

function resolveStatusCode(errorCode: string) {
  if (errorCode === "APPOINTMENT_NOT_FOUND") {
    return 404;
  }

  if (errorCode === "APPOINTMENT_STATUS_INVALID_TRANSITION") {
    return 409;
  }

  return 400;
}

export async function POST(request: Request, { params }: AdminRejectRouteProps) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(buildErrorPayload("ADMIN_UNAUTHORIZED"), {
      status: 401,
    });
  }

  try {
    const { appointmentId: rawAppointmentId } = await params;
    const appointmentId = parseAppointmentIdParam(rawAppointmentId);
    const response = await rejectPendingAppointment(appointmentId);

    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);

    return NextResponse.json(buildErrorPayload(errorCode), {
      status: resolveStatusCode(errorCode),
    });
  }
}
