import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getAdminDayAgenda } from "@/lib/admin/appointments/service";
import { parseAdminDayAgendaParams } from "@/lib/admin/appointments/validation";
import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminDayAgendaRouteProps = {
  params: Promise<{
    month: string;
    date: string;
  }>;
};

function resolveStatusCode(errorCode: string) {
  if (errorCode === "MONTH_NOT_REGISTERED") {
    return 404;
  }

  if (errorCode === "DATE_OUTSIDE_MONTH" || errorCode === "DATE_INVALID_FORMAT") {
    return 400;
  }

  return 400;
}

export async function GET(_request: Request, { params }: AdminDayAgendaRouteProps) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(buildErrorPayload("ADMIN_UNAUTHORIZED"), {
      status: 401,
    });
  }

  try {
    const { month, date } = await params;
    const parsed = parseAdminDayAgendaParams({ month, date });
    const response = await getAdminDayAgenda(parsed);

    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);

    return NextResponse.json(buildErrorPayload(errorCode), {
      status: resolveStatusCode(errorCode),
    });
  }
}
