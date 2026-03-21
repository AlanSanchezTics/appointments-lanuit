import React from "react";

type ButtonVariant = "primary" | "secondary";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  fullWidth = false,
  disabled = false,
  children,
  className = "",
  ...props
}: ButtonProps) {
  const base =
    "h-12 px-4 rounded-xl font-semibold transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-primary)]";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-[var(--admin-accent)] text-white hover:opacity-90",
    secondary: "bg-[var(--admin-inactive-bg)] text-[var(--admin-text-primary)]",
  };
  const disabledStyle = "opacity-50 cursor-not-allowed";

  return (
    <button
      className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${
        disabled ? disabledStyle : ""
      } ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
