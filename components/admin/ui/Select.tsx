import React from "react";

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
  placeholder = "Seleccionar",
  className = "",
  ...props
}: SelectProps) {
  return (
    <div className="relative w-full">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`
          w-full h-11 px-3 rounded-xl
          border border-[#E5E7EB]
          bg-white text-[#1C1917]
          appearance-none outline-none
          ${className}
        `}
        {...props}
      >
        <option value="">{placeholder}</option>

        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
        ▼
      </span>
    </div>
  );
}
