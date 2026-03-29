import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { cancelAdminAppointment } from "@/lib/admin/appointments/service";
import {
  parseAdminCancelPayload,
  parseAppointmentIdParam,
} from "@/lib/admin/appointments/validation";
import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminCancelRouteProps = {
  params: Promise<{
    appointmentId: string;
  }>;
};

function resolveStatusCode(errorCode: string) {
  if (errorCode === "MONTH_NOT_REGISTERED" || errorCode === "APPOINTMENT_NOT_FOUND") {
    return 404;
  }

  return 400;
}

export async function POST(request: Request, { params }: AdminCancelRouteProps) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(buildErrorPayload("ADMIN_UNAUTHORIZED"), {
      status: 401,
    });
  }

  try {
    const { appointmentId: rawAppointmentId } = await params;
    const appointmentId = parseAppointmentIdParam(rawAppointmentId);
    const payload = parseAdminCancelPayload(await request.json());
    const response = await cancelAdminAppointment(appointmentId, payload);

    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);

    return NextResponse.json(buildErrorPayload(errorCode), {
      status: resolveStatusCode(errorCode),
    });
  }
}
