import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonVariantsOptions = {
  variant?: NonNullable<ButtonProps["variant"]>;
  className?: string;
  disabled?: boolean;
  fullWidth?: boolean;
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "border border-transparent bg-[var(--accent)] text-white shadow-[var(--shadow-button)] hover:brightness-95 focus-visible:outline-[var(--accent-dark)]",
  secondary:
    "border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--foreground)] hover:border-[var(--accent)] focus-visible:outline-[var(--accent)]",
  ghost:
    "border border-transparent bg-transparent text-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-[var(--accent)]",
};

const baseButtonClasses =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full px-4 py-2 text-sm font-bold tracking-[-0.01em] transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  children: React.ReactNode;
}

const disabledStyle = "opacity-50 cursor-not-allowed";

export function buttonVariants({
  variant = "primary",
  className = "",
  disabled = false,
  fullWidth = false,
}: ButtonVariantsOptions = {}) {
  return `${baseButtonClasses} ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${disabled ? disabledStyle : ""} ${className}`;
}

export function Button({
  variant = "primary",
  fullWidth = false,
  disabled = false,
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonVariants({ variant, className, disabled, fullWidth })}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
