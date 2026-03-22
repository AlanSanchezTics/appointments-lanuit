import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { MonthsCatalogView } from "@/components/admin/months/MonthsCatalogView";
import { getMonthsCatalog } from "@/lib/admin/months/service";
import { parseMonthsCatalogQueryOrDefault } from "@/lib/admin/months/validation";

type AdminMonthsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminMonthsPage({ searchParams }: AdminMonthsPageProps) {
  const session = await auth();

  if (!session) {
    redirect("/admin/login");
  }

  const query = parseMonthsCatalogQueryOrDefault(await searchParams);
  const initialData = await getMonthsCatalog(query);

  return (
    <AdminLayout>
      <MonthsCatalogView initialData={initialData} />
    </AdminLayout>
  );
}
