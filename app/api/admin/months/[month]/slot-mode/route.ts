import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";
import {
  AffectedAppointmentsConfirmationError,
  updateAdminMonthSlotMode,
} from "@/lib/admin/months/service";
import {
  parseAdminMonthKey,
  parseUpdateMonthSlotModePayload,
} from "@/lib/admin/months/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminMonthSlotModeRouteProps = {
  params: Promise<{
    month: string;
  }>;
};

function resolveStatusCode(errorCode: string) {
  if (errorCode === "MONTH_NOT_REGISTERED") {
    return 404;
  }

  if (errorCode === "MONTH_IN_PAST") {
    return 422;
  }

  if (errorCode === "AVAILABILITY_VERSION_CONFLICT" || errorCode === "AFFECTED_APPOINTMENTS_CONFIRMATION_REQUIRED") {
    return 409;
  }

  return 400;
}

export async function PATCH(request: Request, { params }: AdminMonthSlotModeRouteProps) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(buildErrorPayload("ADMIN_UNAUTHORIZED"), {
      status: 401,
    });
  }

  try {
    const { month } = await params;
    const monthKey = parseAdminMonthKey(month);
    const payload = parseUpdateMonthSlotModePayload(await request.json());
    const response = await updateAdminMonthSlotMode(monthKey, payload);

    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);
    const body = error instanceof AffectedAppointmentsConfirmationError
      ? {
          ...buildErrorPayload(errorCode),
          affectedCount: error.affectedAppointments.length,
          affectedAppointments: error.affectedAppointments,
        }
      : buildErrorPayload(errorCode);

    return NextResponse.json(body, {
      status: resolveStatusCode(errorCode),
    });
  }
}
