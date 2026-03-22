import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";
import { getAdminMonthDetail } from "@/lib/admin/months/detail-service";
import { parseAdminMonthKey } from "@/lib/admin/months/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminMonthDetailRouteProps = {
  params: Promise<{
    month: string;
  }>;
};

function resolveStatusCode(errorCode: string) {
  if (errorCode === "MONTH_NOT_REGISTERED") {
    return 404;
  }

  return 400;
}

export async function GET(_request: Request, { params }: AdminMonthDetailRouteProps) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(buildErrorPayload("ADMIN_UNAUTHORIZED"), {
      status: 401,
    });
  }

  try {
    const { month } = await params;
    const monthKey = parseAdminMonthKey(month);
    const response = await getAdminMonthDetail(monthKey);

    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);
    return NextResponse.json(buildErrorPayload(errorCode), {
      status: resolveStatusCode(errorCode),
    });
  }
}
