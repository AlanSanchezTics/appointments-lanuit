import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { ContentWrapper } from "@/components/admin/layout/ContentWrapper";
import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { Card } from "@/components/admin/ui/Card";
import { ListItem } from "@/components/admin/ui/ListItem";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { adminIcons } from "@/components/admin/ui/admin-icons";
import { resolveServerLanguage } from "@/lib/i18n/language";
import { getServerT } from "@/lib/i18n/server";

export default async function AdminDashboardPage() {
  const session = await auth();
  const language = resolveServerLanguage((await cookies()).toString());
  const t = await getServerT(language);

  if (!session) {
    redirect("/admin/login");
  }

  return (
    <AdminLayout>
      <ContentWrapper>
        <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
          <MetricCard
            icon={<AdminIcon icon={adminIcons.appointmentsToday} />}
            label={t("dashboard.metrics.appointmentsToday", { ns: "admin" })}
            value="--"
          />
          <MetricCard
            icon={<AdminIcon icon={adminIcons.pending} />}
            label={t("dashboard.metrics.pending", { ns: "admin" })}
            value="--"
          />
          <MetricCard
            icon={<AdminIcon icon={adminIcons.syncFailed} />}
            label={t("dashboard.metrics.syncFailed", { ns: "admin" })}
            value="--"
            className="col-span-2 md:col-span-1"
          />
        </section>

        <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <Card>
            <h2 className="mb-4 text-lg font-bold text-[var(--admin-text-primary)]">
              {t("dashboard.navigation.title", { ns: "admin" })}
            </h2>
            <div className="space-y-3">
              <ListItem
                icon={<AdminIcon icon={adminIcons.monthsManagement} />}
                title={t("dashboard.navigation.monthsManagement", { ns: "admin" })}
              />
              <ListItem
                icon={<AdminIcon icon={adminIcons.dailyAppointments} />}
                title={t("dashboard.navigation.dailyAppointments", { ns: "admin" })}
              />
              <ListItem
                icon={<AdminIcon icon={adminIcons.syncRetries} />}
                title={t("dashboard.navigation.syncRetries", { ns: "admin" })}
              />
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-bold text-[var(--admin-text-primary)]">
              {t("dashboard.upcoming.title", { ns: "admin" })}
            </h2>
            <ul className="space-y-2 text-sm text-[var(--admin-text-secondary)]">
              <li>{t("dashboard.upcoming.reports", { ns: "admin" })}</li>
              <li>{t("dashboard.upcoming.audit", { ns: "admin" })}</li>
              <li>{t("dashboard.upcoming.settings", { ns: "admin" })}</li>
            </ul>
          </Card>
        </section>
      </ContentWrapper>
    </AdminLayout>
  );
}
