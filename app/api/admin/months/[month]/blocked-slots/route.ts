import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { createAdminBlockedSlots } from "@/lib/admin/blocked-spaces/service";
import { parseCreateBlockedSlotsPayload } from "@/lib/admin/blocked-spaces/validation";
import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function resolveStatusCode(errorCode: string) {
  if (errorCode === "MONTH_NOT_REGISTERED") {
    return 404;
  }

  if (
    errorCode === "SLOT_NOT_AVAILABLE"
    || errorCode === "SLOT_LOCKED"
    || errorCode === "DAY_ALREADY_BLOCKED"
    || errorCode === "BLOCKED_SLOT_ALREADY_EXISTS"
  ) {
    return 409;
  }

  if (errorCode === "DATE_IN_PAST") {
    return 422;
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

type AdminBlockedSlotsRouteProps = {
  params: Promise<{
    month: string;
  }>;
};

export async function POST(request: Request, { params }: AdminBlockedSlotsRouteProps) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(buildErrorPayload("ADMIN_UNAUTHORIZED"), {
      status: 401,
    });
  }

  try {
    const { month } = await params;
    const payload = parseCreateBlockedSlotsPayload({
      ...(await request.json()),
      month,
    });

    const response = await createAdminBlockedSlots({
      ...payload,
      createdByAdminId: resolveAdminId(session.user?.id),
    });

    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);

    return NextResponse.json(buildErrorPayload(errorCode), {
      status: resolveStatusCode(errorCode),
    });
  }
}
