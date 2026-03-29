import type { WeeklyOccupancySummary } from "@/lib/admin/dashboard/types";

import { AdminIcon } from "./AdminIcon";
import { Card } from "./Card";
import { adminIcons } from "./admin-icons";

interface DailyOccupancyCardProps {
  data: WeeklyOccupancySummary["dailyOccupancy"];
  title: string;
  scheduledTodayLabel: string;
}

export function DailyOccupancyCard({
  data,
  title,
  scheduledTodayLabel,
}: DailyOccupancyCardProps) {
  return (
    <Card className="mb-6 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-canvas)] px-5 py-4 shadow-none">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--admin-text-secondary)]">
          {title}
        </h2>
        <p className="text-2xl font-extrabold leading-none text-[var(--admin-accent)]">
          {data.occupancyPercent}%
        </p>
      </div>

      <div className="mt-4 h-3.5 overflow-hidden rounded-full bg-[#e3e3e3]">
        <div
          className="h-full rounded-full bg-[var(--admin-primary)] transition-[width] duration-300"
          style={{ width: `${data.occupancyPercent}%` }}
        />
      </div>

      <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--admin-text-primary)]">
        <AdminIcon
          icon={adminIcons.info}
          tone="primary"
          className="text-[13px]"
        />
        {scheduledTodayLabel}
      </p>
    </Card>
  );
}
