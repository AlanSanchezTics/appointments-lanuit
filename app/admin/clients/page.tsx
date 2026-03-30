import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { ClientsCatalogView } from "@/components/admin/clients/ClientsCatalogView";
import { getAdminClientsCatalog } from "@/lib/admin/clients/catalog-service";
import { parseAdminClientsCatalogQueryOrDefault } from "@/lib/admin/clients/validation";

type AdminClientsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminClientsPage({ searchParams }: AdminClientsPageProps) {
  const session = await auth();

  if (!session) {
    redirect("/admin/login");
  }

  const query = parseAdminClientsCatalogQueryOrDefault(await searchParams);
  const initialData = await getAdminClientsCatalog(query);

  return (
    <AdminLayout>
      <ClientsCatalogView initialData={initialData} />
    </AdminLayout>
  );
}
