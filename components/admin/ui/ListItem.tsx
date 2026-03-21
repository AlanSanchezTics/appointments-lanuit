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
  return (
    <div
      onClick={!disabled ? onClick : undefined}
      className={`
        flex items-center justify-between
        bg-white rounded-xl p-4 min-h-[64px]
        ${disabled ? "opacity-50" : "cursor-pointer"}
        ${className}
      `}
      role={onClick && !disabled ? "button" : undefined}
      tabIndex={onClick && !disabled ? 0 : undefined}
      onKeyDown={(e) => {
        if (!disabled && onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="flex items-center gap-3">
        <div className="text-[#875207]">{icon}</div>
        <span className="text-[14px] font-medium text-[#1C1917]">{title}</span>
      </div>

      <span className="text-gray-400">{rightContent ?? ">"}</span>
    </div>
  );
}
