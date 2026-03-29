import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";
import { searchAdminClients } from "@/lib/admin/clients/service";
import { parseSearchAdminClientsQuery } from "@/lib/admin/clients/validation";

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
    const input = parseSearchAdminClientsQuery(url.searchParams);
    const response = await searchAdminClients(input);

    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);

    return NextResponse.json(buildErrorPayload(errorCode), {
      status: 400,
    });
  }
}
