"use client";

import React from "react";
import Link from "next/link";

export interface ListItemProps {
  icon: React.ReactNode;
  title: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  className?: string;
  rightContent?: React.ReactNode;
}

export function ListItem({
  icon,
  title,
  onClick,
  href,
  disabled = false,
  className = "",
  rightContent,
}: ListItemProps) {
  const isInteractive = (Boolean(onClick) || Boolean(href)) && !disabled;
  const content = (
    <>
      <div className="flex items-center gap-3">
        <div className="text-[var(--admin-accent)]">{icon}</div>
        <span className="text-[14px] font-bold text-[var(--admin-text-primary)]">
          {title}
        </span>
      </div>

      <span className="text-[var(--admin-text-secondary)]">
        {rightContent ?? ">"}
      </span>
    </>
  );

  const baseClassName = `
    flex items-center justify-between
    rounded-xl bg-[var(--admin-surface)] p-4 min-h-[64px]
    ${disabled ? "opacity-50" : ""}
    ${isInteractive ? "cursor-pointer" : ""}
    ${className}
  `;

  if (href && !disabled) {
    return (
      <Link href={href} className={baseClassName}>
        {content}
      </Link>
    );
  }

  return (
    <div
      onClick={isInteractive ? onClick : undefined}
      className={baseClassName}
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
      {content}
    </div>
  );
}
