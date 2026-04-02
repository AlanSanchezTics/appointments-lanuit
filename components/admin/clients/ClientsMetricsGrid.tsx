"use client";

import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { MetricCard } from "@/components/admin/ui/MetricCard";
import { adminIcons } from "@/components/admin/ui/admin-icons";

type ClientsMetricsGridProps = {
  totalClients: number;
  withFutureAppointments: number;
  withoutFutureAppointments: number;
  loyalClients: number;
  labels: {
    totalClients: string;
    withFutureAppointments: string;
    withoutFutureAppointments: string;
    loyalClients: string;
  };
};

export function ClientsMetricsGrid({
  totalClients,
  withFutureAppointments,
  withoutFutureAppointments,
  loyalClients,
  labels,
}: ClientsMetricsGridProps) {
  return (
    <section className="grid grid-cols-2 gap-3">
      <MetricCard
        icon={<AdminIcon icon={adminIcons.clientsAnalytics} />}
        label={labels.totalClients}
        value={totalClients}
        className="min-h-[112px] p-3"
      />
      <MetricCard
        icon={<AdminIcon icon={adminIcons.futureAppointments} />}
        label={labels.withFutureAppointments}
        value={withFutureAppointments}
        className="min-h-[112px] p-3"
      />
      <MetricCard
        icon={<AdminIcon icon={adminIcons.monthInactive} tone="accent" />}
        label={labels.withoutFutureAppointments}
        value={withoutFutureAppointments}
        className="min-h-[112px] p-3"
      />
      <MetricCard
        icon={<AdminIcon icon={adminIcons.busiestDay} tone="accent" />}
        label={labels.loyalClients}
        value={loyalClients}
        className="min-h-[112px] p-3"
      />
    </section>
  );
}
