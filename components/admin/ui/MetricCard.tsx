import React from "react";
import { Card } from "./Card";

export interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  className?: string;
}

export function MetricCard({
  icon,
  label,
  value,
  className = "",
}: MetricCardProps) {
  return (
    <Card
      className={`flex flex-col items-center justify-center gap-2 text-center ${className}`}
    >
      <div className="text-xl text-[var(--admin-accent)]">{icon}</div>

      <span className="text-[10px] font-bold uppercase text-[var(--admin-text-secondary)]">
        {label}
      </span>

      <span className="text-[16px] font-extrabold text-[var(--admin-text-primary)]">{value}</span>
    </Card>
  );
}
