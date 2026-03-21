import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { ContentWrapper } from "@/components/admin/layout/ContentWrapper";
import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { Card } from "@/components/admin/ui/Card";
import { ListItem } from "@/components/admin/ui/ListItem";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { adminIcons } from "@/components/admin/ui/admin-icons";

export default async function AdminDashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/admin/login");
  }

  return (
    <AdminLayout>
      <ContentWrapper>
        <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <MetricCard
            icon={<AdminIcon icon={adminIcons.appointmentsToday} />}
            label="Citas hoy"
            value="--"
          />
          <MetricCard
            icon={<AdminIcon icon={adminIcons.pending} />}
            label="Pendientes"
            value="--"
          />
          <MetricCard
            icon={<AdminIcon icon={adminIcons.syncFailed} />}
            label="Sync fallidos"
            value="--"
            className="col-span-2 md:col-span-1"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card>
            <h2 className="mb-4 text-lg font-bold text-[var(--admin-text-primary)]">Navegación</h2>
            <div className="space-y-3">
              <ListItem icon={<AdminIcon icon={adminIcons.monthsManagement} />} title="Gestión de meses" />
              <ListItem icon={<AdminIcon icon={adminIcons.dailyAppointments} />} title="Citas del día" />
              <ListItem icon={<AdminIcon icon={adminIcons.syncRetries} />} title="Reintentos de sincronización" />
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-bold text-[var(--admin-text-primary)]">Próximas secciones</h2>
            <ul className="space-y-2 text-sm text-[var(--admin-text-secondary)]">
              <li>Reportes operativos</li>
              <li>Auditoría de cambios</li>
              <li>Configuración del panel</li>
            </ul>
          </Card>
        </section>
      </ContentWrapper>
    </AdminLayout>
  );
}
