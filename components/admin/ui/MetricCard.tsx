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
      <div className="text-[#875207] text-xl">{icon}</div>

      <span className="text-[10px] font-bold uppercase text-gray-500">
        {label}
      </span>

      <span className="text-[16px] font-extrabold text-[#1C1917]">{value}</span>
    </Card>
  );
}
