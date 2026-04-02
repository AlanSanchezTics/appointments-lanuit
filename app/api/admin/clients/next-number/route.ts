import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";
import { getNextClientNumberSuggestion } from "@/lib/clients/client-number-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await auth();

  if (!session) {
    return NextResponse.json(buildErrorPayload("ADMIN_UNAUTHORIZED"), {
      status: 401,
    });
  }

  try {
    const nextClientNumber = await getNextClientNumberSuggestion();

    return NextResponse.json({
      nextClientNumber,
    });
  } catch (error) {
    const errorCode = normalizeErrorCode(error);
    return NextResponse.json(buildErrorPayload(errorCode), { status: 400 });
  }
}
