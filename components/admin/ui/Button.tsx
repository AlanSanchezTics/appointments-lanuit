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
  const base = "h-12 px-4 rounded-xl font-semibold transition-all duration-200";
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-[#875207] text-white hover:opacity-90",
    secondary: "bg-[#F5F3EF] text-[#1C1917]",
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
