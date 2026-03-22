import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { MonthDetailView } from "@/components/admin/months/MonthDetailView";
import { getAdminMonthDetail } from "@/lib/admin/months/detail-service";
import { parseAdminMonthKey } from "@/lib/admin/months/validation";

type AdminMonthPageProps = {
  params: Promise<{
    month: string;
  }>;
};

export default async function AdminMonthPage({
  params,
}: AdminMonthPageProps) {
  const session = await auth();

  if (!session) {
    redirect("/admin/login");
  }

  const { month } = await params;

  let monthKey = "";

  try {
    monthKey = parseAdminMonthKey(month);
  } catch {
    notFound();
  }

  try {
    const initialData = await getAdminMonthDetail(monthKey);

    return (
      <AdminLayout>
        <MonthDetailView month={monthKey} initialData={initialData} />
      </AdminLayout>
    );
  } catch (error) {
    if (error instanceof Error && error.message === "MONTH_NOT_REGISTERED") {
      notFound();
    }

    throw error;
  }
}
