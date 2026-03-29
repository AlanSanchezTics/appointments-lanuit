import type { DailyTip } from "@/lib/admin/dashboard/types";

import { AdminIcon } from "./AdminIcon";
import { Card } from "./Card";
import { adminIcons } from "./admin-icons";

interface DailyTipCardProps {
  title: string;
  tip: DailyTip;
}

export function DailyTipCard({ title, tip }: DailyTipCardProps) {
  return (
    <Card className="mb-6 rounded-3xl border border-[color-mix(in_srgb,var(--admin-primary)_24%,white)] bg-[rgba(243,229,214,0.55)]! p-5 shadow-none">
      <div className="flex items-center gap-4">
        <div className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--admin-primary)] text-white">
          <AdminIcon icon={adminIcons.dailyTip} className="text-white" />
        </div>

        <div className="min-w-0 pt-1">
          <h2 className="text-[16px] font-bold leading-[1.05] tracking-[-0.03em] text-[var(--admin-accent)]">
            {title}
          </h2>
          <p className="mt-3 text-[14px] font-medium leading-[1.22] tracking-[-0.025em] text-[var(--admin-text-primary)]">
            {tip.content}
          </p>
        </div>
      </div>
    </Card>
  );
}
