import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";
import { getAdminClientsCatalog } from "@/lib/admin/clients/catalog-service";
import { parseAdminClientsCatalogQuery } from "@/lib/admin/clients/validation";

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
    const url = new URL(request.url);
    const query = parseAdminClientsCatalogQuery(url.searchParams);
    const response = await getAdminClientsCatalog(query);

    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);

    return NextResponse.json(buildErrorPayload(errorCode), {
      status: 400,
    });
  }
}
