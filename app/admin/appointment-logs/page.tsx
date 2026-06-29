import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AppointmentLogsView } from "@/components/admin/appointment-logs/AppointmentLogsView";
import { getAdminAppointmentLogs } from "@/lib/admin/appointment-logs/service";
import { parseAdminAppointmentLogsQuery } from "@/lib/admin/appointment-logs/validation";

type AdminAppointmentLogsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminAppointmentLogsPage({
  searchParams,
}: AdminAppointmentLogsPageProps) {
  const session = await auth();

  if (!session) {
    redirect("/admin/login");
  }

  const params = await searchParams;
  const query = parseAdminAppointmentLogsQuery(params);
  const initialData = await getAdminAppointmentLogs({
    client: query.client,
    actionType: query.actionType,
    month: query.month,
    actionDateFrom: query.actionDateFrom,
    actionDateTo: query.actionDateTo,
    page: query.page,
    pageSize: query.pageSize,
  });

  return (
    <AdminLayout>
      <AppointmentLogsView initialData={initialData} />
    </AdminLayout>
  );
}
