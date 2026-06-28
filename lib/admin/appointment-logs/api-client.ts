import type {
  AdminAppointmentLogsQuery,
  AdminAppointmentLogsResponse,
} from "@/lib/admin/appointment-logs/types";

function buildQueryString(filters: AdminAppointmentLogsQuery) {
  const params = new URLSearchParams();

  params.set("page", String(filters.page));
  params.set("pageSize", String(filters.pageSize));

  if (filters.client.trim()) {
    params.set("client", filters.client.trim());
  }

  if (filters.actionType) {
    params.set("actionType", filters.actionType);
  }

  if (filters.month) {
    params.set("month", filters.month);
  }

  if (filters.actionDateFrom) {
    params.set("actionDateFrom", filters.actionDateFrom);
  }

  if (filters.actionDateTo) {
    params.set("actionDateTo", filters.actionDateTo);
  }

  if (filters.format !== "json") {
    params.set("format", filters.format);
  }

  return params.toString();
}

export async function fetchAdminAppointmentLogs(
  filters: AdminAppointmentLogsQuery,
  signal?: AbortSignal,
): Promise<AdminAppointmentLogsResponse> {
  const response = await fetch(`/api/admin/appointment-logs?${buildQueryString(filters)}`, {
    signal,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { errorCode?: string; error?: string }
      | null;
    throw new Error(payload?.errorCode ?? payload?.error ?? "UNKNOWN_ERROR");
  }

  return response.json() as Promise<AdminAppointmentLogsResponse>;
}
