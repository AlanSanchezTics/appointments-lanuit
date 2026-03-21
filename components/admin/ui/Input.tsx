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
    <div className="relative block">
      <label className="relative block" htmlFor={id}>
        {label ? (
          <span className="absolute left-5 top-0 -translate-y-1/2 bg-[var(--surface)] px-1 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[var(--accent)]">
            {label}
          </span>
        ) : null}
        <input
          id={id}
          className={`w-full rounded-full border border-[var(--admin-border)] bg-white px-6 py-4 text-[0.96rem] font-medium tracking-[-0.01em] text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] ${className}`}
          {...props}
        />
        {icon ? (
          <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[var(--admin-text-secondary)]">
            {icon}
          </div>
        ) : null}
      </label>
      {error ? (
        <p
          className="mt-2 text-xs font-medium text-[var(--error)]"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
