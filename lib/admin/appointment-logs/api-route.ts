import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { buildErrorPayload, normalizeErrorCode } from "@/lib/api/error-response";
import {
  getAdminAppointmentLogs,
  getAdminAppointmentLogsForExport,
} from "@/lib/admin/appointment-logs/service";
import { parseAdminAppointmentLogsQuery } from "@/lib/admin/appointment-logs/validation";
import {
  buildAppointmentLogsPdfDocument,
  buildAppointmentLogsPdfFilename,
} from "@/lib/admin/appointment-logs/pdf";

function resolveStatusCode(errorCode: string) {
  if (errorCode === "EXPORT_LIMIT_EXCEEDED") {
    return 422;
  }

  if (errorCode === "UNSUPPORTED_EXPORT_FORMAT") {
    return 400;
  }

  return 400;
}

export async function handleAdminAppointmentLogsRequest(request: Request) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(buildErrorPayload("ADMIN_UNAUTHORIZED"), {
      status: 401,
    });
  }

  try {
    const query = parseAdminAppointmentLogsQuery(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );

    if (query.format === "pdf") {
      const exportResult = await getAdminAppointmentLogsForExport({
        client: query.client,
        actionType: query.actionType,
        month: query.month,
        actionDateFrom: query.actionDateFrom,
        actionDateTo: query.actionDateTo,
      });
      const generatedAt = new Date();
      const pdf = buildAppointmentLogsPdfDocument({
        title: "Registro de citas",
        generatedAt,
        filters: {
          client: query.client,
          actionType: query.actionType,
          month: query.month,
          actionDateFrom: query.actionDateFrom,
          actionDateTo: query.actionDateTo,
        },
        items: exportResult.items,
      });

      return new Response(pdf, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${buildAppointmentLogsPdfFilename(generatedAt)}"`,
        },
      });
    }

    const response = await getAdminAppointmentLogs({
      client: query.client,
      actionType: query.actionType,
      month: query.month,
      actionDateFrom: query.actionDateFrom,
      actionDateTo: query.actionDateTo,
      page: query.page,
      pageSize: query.pageSize,
    });
    return NextResponse.json(response);
  } catch (error) {
    const errorCode = normalizeErrorCode(error);

    return NextResponse.json(buildErrorPayload(errorCode), {
      status: resolveStatusCode(errorCode),
    });
  }
}
