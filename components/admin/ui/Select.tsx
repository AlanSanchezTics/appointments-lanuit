import { faCaretDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
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
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  showPlaceholder?: boolean;
}

export function Select({
  label,
  value,
  options,
  onChange,
  placeholder,
  showPlaceholder = true,
  className = "",
  id,
  ...props
}: SelectProps) {
  const { t } = useTranslation("admin");
  const selectPlaceholder = placeholder ?? t("common.selectPlaceholder");

  return (
    <div className="relative w-full block">
      <label className="relative block" htmlFor={id}>
        {label ? (
          <span className="absolute left-5 top-0 -translate-y-1/2 bg-[var(--surface)] px-1 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
            {label}
          </span>
        ) : null}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`
          w-full h-11 px-3 rounded-full
          border border-[var(--admin-border)]
          bg-[var(--admin-surface)] text-[var(--admin-text-primary)]
          appearance-none outline-none
          ${className}
        `}
          {...props}
        >
          {showPlaceholder ? (
            <option value="">{selectPlaceholder}</option>
          ) : null}

          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--admin-text-secondary)]">
          <FontAwesomeIcon icon={faCaretDown} />
        </span>
      </label>
    </div>
  );
}
