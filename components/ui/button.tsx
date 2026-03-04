type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)]",
  secondary: "border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--foreground)] hover:border-[var(--accent)]",
  ghost: "bg-transparent text-[var(--muted)] hover:text-[var(--foreground)]",
};

export function Button({ className = "", variant = "primary", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition ${variantClasses[variant]} disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      {...props}
    />
  );
}
