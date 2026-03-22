import React from "react";
import { useTranslation } from "react-i18next";

export interface SelectOption {
  label: string;
  value: string;
}

export interface SelectProps extends Omit<
  React.SelectHTMLAttributes<HTMLSelectElement>,
  "onChange"
> {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export function Select({
  value,
  options,
  onChange,
  placeholder,
  className = "",
  ...props
}: SelectProps) {
  const { t } = useTranslation("admin");
  const selectPlaceholder = placeholder ?? t("common.selectPlaceholder");

  return (
    <div className="relative w-full">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`
          w-full h-11 px-3 rounded-xl
          border border-[var(--admin-border)]
          bg-[var(--admin-surface)] text-[var(--admin-text-primary)]
          appearance-none outline-none
          ${className}
        `}
        {...props}
      >
        <option value="">{selectPlaceholder}</option>

        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-secondary)]">
        ▼
      </span>
    </div>
  );
}
