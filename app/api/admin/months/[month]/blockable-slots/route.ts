import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getAdminBlockableSlots } from "@/lib/admin/blocked-spaces/service";
import { parseBlockableSlotsParams } from "@/lib/admin/blocked-spaces/validation";
import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminBlockableSlotsRouteProps = {
  params: Promise<{
    month: string;
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

export async function GET(request: Request, { params }: AdminBlockableSlotsRouteProps) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(buildErrorPayload("ADMIN_UNAUTHORIZED"), {
      status: 401,
    });
  }

  try {
    const { month } = await params;
    const date = new URL(request.url).searchParams.get("date");
    const parsed = parseBlockableSlotsParams({ month, date });
    const response = await getAdminBlockableSlots(parsed);

    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);

    return NextResponse.json(buildErrorPayload(errorCode), {
      status: resolveStatusCode(errorCode),
    });
  }
}
