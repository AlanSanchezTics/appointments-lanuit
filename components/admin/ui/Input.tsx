import React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: React.ReactNode;
  error?: string | null;
}

export function Input({
  label,
  icon,
  error,
  className = "",
  id,
  ...props
}: InputProps) {
  return (
    <div className="relative">
      <label
        htmlFor={id}
        className="absolute -top-2 left-6 z-10 bg-[var(--admin-canvas)] px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--admin-primary)]"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          className={`h-11 w-full rounded-[9999px] border border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 pr-12 text-sm text-[var(--admin-text-primary)] outline-none transition-colors focus:border-[var(--admin-primary)] ${className}`}
          {...props}
        />
        {icon ? (
          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--admin-text-secondary)]">
            {icon}
          </div>
        ) : null}
      </div>
      {error ? (
        <p className="mt-2 text-xs font-medium text-[var(--error)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
