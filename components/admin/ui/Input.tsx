"use client";

import React from "react";

import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { adminIcons } from "@/components/admin/ui/admin-icons";
import { usePasswordVisibility } from "@/hooks/shared/usePasswordVisibility";

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
  const isPasswordInput = props.type === "password";
  const { inputType, ariaLabel, toggleVisibility, visible } =
    usePasswordVisibility({
      enabled: isPasswordInput,
    });

  const inputPaddingClassName = isPasswordInput
    ? icon
      ? "pl-12 pr-14"
      : "px-6 pr-14"
    : icon
      ? "pl-12 pr-6"
      : "px-6";

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
          className={`w-full rounded-full border border-[var(--admin-border)] bg-white py-4 text-[0.96rem] font-medium tracking-[-0.01em] text-[var(--foreground)] outline-none transition focus:border-[var(--accent)] ${inputPaddingClassName} ${className}`}
          {...props}
          type={isPasswordInput ? inputType : props.type}
        />
        {icon ? (
          <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--admin-text-secondary)]">
            {icon}
          </div>
        ) : null}
        {isPasswordInput ? (
          <button
            type="button"
            className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--admin-text-secondary)] outline-none transition hover:text-[var(--admin-accent)] focus-visible:text-[var(--admin-accent)]"
            aria-label={ariaLabel}
            onClick={toggleVisibility}
            disabled={props.disabled}
          >
            <AdminIcon
              icon={visible ? adminIcons.passwordHide : adminIcons.passwordShow}
              tone="secondary"
            />
          </button>
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
