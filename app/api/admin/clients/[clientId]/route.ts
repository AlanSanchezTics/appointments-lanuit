import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";
import { getAdminClientDetail } from "@/lib/admin/clients/detail-service";
import { updateAdminClient } from "@/lib/admin/clients/update-service";
import {
  parseAdminClientIdParam,
  parseUpdateAdminClientPayload,
} from "@/lib/admin/clients/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AdminClientRouteProps = {
  params: Promise<{
    clientId: string;
  }>;
};

function resolveStatusCode(errorCode: string) {
  if (errorCode === "CLIENT_NOT_FOUND") {
    return 404;
  }

  return 400;
}

export async function GET(
  request: Request,
  { params }: AdminClientRouteProps,
) {
  void request;
  const session = await auth();

  if (!session) {
    return NextResponse.json(buildErrorPayload("ADMIN_UNAUTHORIZED"), {
      status: 401,
    });
  }

  try {
    const { clientId: rawClientId } = await params;
    const clientId = parseAdminClientIdParam(rawClientId);
    const response = await getAdminClientDetail(clientId);

    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);

    return NextResponse.json(buildErrorPayload(errorCode), {
      status: resolveStatusCode(errorCode),
    });
  }
}

export async function PATCH(
  request: Request,
  { params }: AdminClientRouteProps,
) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(buildErrorPayload("ADMIN_UNAUTHORIZED"), {
      status: 401,
    });
  }

  try {
    const { clientId: rawClientId } = await params;
    const clientId = parseAdminClientIdParam(rawClientId);
    const payload = parseUpdateAdminClientPayload(await request.json());
    const response = await updateAdminClient(clientId, payload);

    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);

    return NextResponse.json(buildErrorPayload(errorCode), {
      status: resolveStatusCode(errorCode),
    });
  }
}
