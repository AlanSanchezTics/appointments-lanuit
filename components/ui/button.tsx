type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-[var(--accent)] text-white shadow-[var(--shadow-button)] hover:bg-[var(--accent-dark)] focus-visible:outline-[var(--accent-dark)]",
  secondary:
    "border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--foreground)] hover:border-[var(--accent)] focus-visible:outline-[var(--accent)]",
  ghost:
    "bg-transparent text-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-[var(--accent)]",
};

export function Button({
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full px-4 py-2 text-sm font-bold tracking-[-0.01em] transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
