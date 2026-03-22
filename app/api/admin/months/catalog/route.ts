import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";
import { getMonthsCatalog } from "@/lib/admin/months/service";
import { parseMonthsCatalogQuery } from "@/lib/admin/months/validation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(buildErrorPayload("ADMIN_UNAUTHORIZED"), {
      status: 401,
    });
  }

  try {
    const query = parseMonthsCatalogQuery(new URL(request.url).searchParams);
    const response = await getMonthsCatalog(query);

    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);
    return NextResponse.json(buildErrorPayload(errorCode), {
      status: 400,
    });
  }
}
