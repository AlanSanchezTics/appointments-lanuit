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

  const rawSearchParams = await searchParams;
  const query = parseMonthsCatalogQueryOrDefault(rawSearchParams);
  const initialData = await getMonthsCatalog(query);
  // Solo `past=1` muestra meses anteriores; cualquier otro valor los oculta.
  const initialShowPast = rawSearchParams.past === "1";

  return (
    <AdminLayout>
      <MonthsCatalogView initialData={initialData} initialShowPast={initialShowPast} />
    </AdminLayout>
  );
}
