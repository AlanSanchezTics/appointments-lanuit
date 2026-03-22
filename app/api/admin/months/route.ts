import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";
import { createAdminMonths } from "@/lib/admin/months/service";
import { parseCreateAdminMonthsPayload } from "@/lib/admin/months/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(buildErrorPayload("ADMIN_UNAUTHORIZED"), {
      status: 401,
    });
  }

  try {
    const payload = parseCreateAdminMonthsPayload(await request.json());
    const response = await createAdminMonths(payload);

    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);
    return NextResponse.json(buildErrorPayload(errorCode), {
      status: 400,
    });
  }
}
