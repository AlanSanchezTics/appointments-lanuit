import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { ClientDetailView } from "@/components/admin/clients/ClientDetailView";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { getAdminClientDetail } from "@/lib/admin/clients/detail-service";
import { parseAdminClientIdParam } from "@/lib/admin/clients/validation";

type AdminClientDetailPageProps = {
  params: Promise<{
    clientId: string;
  }>;
};

export default async function AdminClientDetailPage({ params }: AdminClientDetailPageProps) {
  const session = await auth();

  if (!session) {
    redirect("/admin/login");
  }

  const { clientId: rawClientId } = await params;

  let clientId = 0;

  try {
    clientId = parseAdminClientIdParam(rawClientId);
  } catch {
    notFound();
  }

  try {
    const initialData = await getAdminClientDetail(clientId);

    return (
      <AdminLayout>
        <ClientDetailView clientId={clientId} initialData={initialData} />
      </AdminLayout>
    );
  } catch (error) {
    if (error instanceof Error && error.message === "CLIENT_NOT_FOUND") {
      notFound();
    }

    throw error;
  }
}
