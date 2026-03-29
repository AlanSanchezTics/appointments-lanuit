import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createAdminAppointment } from "@/lib/admin/appointments/service";
import { parseAdminCreateAppointmentPayload } from "@/lib/admin/appointments/validation";
import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminCreateAppointmentRouteProps = {
  params: Promise<{
    month: string;
  }>;
};

function resolveStatusCode(errorCode: string) {
  if (errorCode === "MONTH_NOT_REGISTERED" || errorCode === "CLIENT_NOT_FOUND") {
    return 404;
  }

  if (errorCode === "SLOT_NOT_AVAILABLE" || errorCode === "SLOT_LOCKED") {
    return 409;
  }

  if (errorCode === "MONTH_NOT_ACTIVE") {
    return 422;
  }

  return 400;
}

export async function POST(
  request: Request,
  { params }: AdminCreateAppointmentRouteProps,
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(buildErrorPayload("ADMIN_UNAUTHORIZED"), {
      status: 401,
    });
  }

  try {
    const { month } = await params;
    const payload = parseAdminCreateAppointmentPayload({
      ...(await request.json()),
      month,
    });
    const response = await createAdminAppointment(payload);

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const errorCode = normalizeErrorCode(error);

    return NextResponse.json(buildErrorPayload(errorCode), {
      status: resolveStatusCode(errorCode),
    });
  }
}
