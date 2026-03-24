import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  deleteAdminBlockedSlot,
  updateAdminBlockedSlot,
} from "@/lib/admin/blocked-spaces/service";
import {
  parseBlockedSlotIdParam,
  parseDeleteBlockedSlotPayload,
  parseUpdateBlockedSlotPayload,
} from "@/lib/admin/blocked-spaces/validation";
import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminBlockedSlotRouteProps = {
  params: Promise<{
    month: string;
    blockedSlotId: string;
  }>;
};

function resolveStatusCode(errorCode: string) {
  if (errorCode === "MONTH_NOT_REGISTERED" || errorCode === "BLOCKED_SLOT_NOT_FOUND") {
    return 404;
  }

  if (errorCode === "BLOCKED_SLOT_NOT_EDITABLE") {
    return 409;
  }

  return 400;
}

export async function PATCH(request: Request, { params }: AdminBlockedSlotRouteProps) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(buildErrorPayload("ADMIN_UNAUTHORIZED"), {
      status: 401,
    });
  }

  try {
    const { month, blockedSlotId: rawBlockedSlotId } = await params;
    const blockedSlotId = parseBlockedSlotIdParam(rawBlockedSlotId);
    const payload = parseUpdateBlockedSlotPayload({
      ...(await request.json()),
      month,
    });
    const response = await updateAdminBlockedSlot({
      ...payload,
      blockedSlotId,
    });

    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);

    return NextResponse.json(buildErrorPayload(errorCode), {
      status: resolveStatusCode(errorCode),
    });
  }
}

export async function DELETE(request: Request, { params }: AdminBlockedSlotRouteProps) {
  void request;
  const session = await auth();

  if (!session) {
    return NextResponse.json(buildErrorPayload("ADMIN_UNAUTHORIZED"), {
      status: 401,
    });
  }

  try {
    const { month, blockedSlotId: rawBlockedSlotId } = await params;
    const blockedSlotId = parseBlockedSlotIdParam(rawBlockedSlotId);
    const payload = parseDeleteBlockedSlotPayload({ month });
    const response = await deleteAdminBlockedSlot({
      ...payload,
      blockedSlotId,
    });

    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);

    return NextResponse.json(buildErrorPayload(errorCode), {
      status: resolveStatusCode(errorCode),
    });
  }
}
