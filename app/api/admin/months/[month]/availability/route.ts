import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";
import {
  AffectedAppointmentsConfirmationError,
  getAvailabilityForMonth,
  saveAvailability,
} from "@/lib/admin/months/service";
import { parseAdminMonthKey, parseSaveAvailabilityPayload } from "@/lib/admin/months/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminMonthAvailabilityRouteProps = {
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

function buildFailurePayload(error: unknown, errorCode: string) {
  if (error instanceof AffectedAppointmentsConfirmationError) {
    return {
      ...buildErrorPayload(errorCode),
      affectedCount: error.affectedAppointments.length,
      affectedAppointments: error.affectedAppointments,
    };
  }

  return buildErrorPayload(errorCode);
}

export async function GET(_request: Request, { params }: AdminMonthAvailabilityRouteProps) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(buildErrorPayload("ADMIN_UNAUTHORIZED"), {
      status: 401,
    });
  }

  try {
    const { month } = await params;
    const response = await getAvailabilityForMonth(parseAdminMonthKey(month));

    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);

    return NextResponse.json(buildErrorPayload(errorCode), {
      status: resolveStatusCode(errorCode),
    });
  }
}

export async function PUT(request: Request, { params }: AdminMonthAvailabilityRouteProps) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(buildErrorPayload("ADMIN_UNAUTHORIZED"), {
      status: 401,
    });
  }

  try {
    const { month } = await params;
    const monthKey = parseAdminMonthKey(month);
    const payload = parseSaveAvailabilityPayload(await request.json());
    const response = await saveAvailability(monthKey, payload);

    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);

    return NextResponse.json(buildFailurePayload(error, errorCode), {
      status: resolveStatusCode(errorCode),
    });
  }
}
