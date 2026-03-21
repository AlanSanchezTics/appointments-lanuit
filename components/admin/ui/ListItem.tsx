 "use client";

import React from "react";

export interface ListItemProps {
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  rightContent?: React.ReactNode;
}

export function ListItem({
  icon,
  title,
  onClick,
  disabled = false,
  className = "",
  rightContent,
}: ListItemProps) {
  const isInteractive = Boolean(onClick) && !disabled;

  return (
    <div
      onClick={isInteractive ? onClick : undefined}
      className={`
        flex items-center justify-between
        rounded-xl bg-[var(--admin-surface)] p-4 min-h-[64px]
        ${disabled ? "opacity-50" : ""}
        ${isInteractive ? "cursor-pointer" : ""}
        ${className}
      `}
      role={isInteractive ? "button" : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onKeyDown={
        isInteractive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <div className="flex items-center gap-3">
        <div className="text-[var(--admin-accent)]">{icon}</div>
        <span className="text-[14px] font-medium text-[var(--admin-text-primary)]">{title}</span>
      </div>

      <span className="text-[var(--admin-text-secondary)]">{rightContent ?? ">"}</span>
    </div>
  );
}
