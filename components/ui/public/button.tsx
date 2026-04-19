type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

type ButtonVariantsOptions = {
  variant?: NonNullable<ButtonProps["variant"]>;
  className?: string;
};

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "border border-transparent bg-[var(--accent)] text-white! hover:brightness-95 focus-visible:outline-[var(--accent-dark)]",
  secondary:
    "border border-[var(--border)] bg-[var(--surface-strong)] text-[var(--foreground)] hover:border-[var(--accent)] focus-visible:outline-[var(--accent)]",
  ghost:
    "border border-transparent bg-transparent text-[var(--muted)] hover:text-[var(--foreground)] focus-visible:outline-[var(--accent)]",
};

const baseButtonClasses =
  "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full px-4 py-2 text-sm font-semibold tracking-[-0.01em] transition duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export function buttonVariants({
  variant = "primary",
  className = "",
}: ButtonVariantsOptions = {}) {
  return `${baseButtonClasses} ${variantClasses[variant]} ${className}`;
}

export function Button({
  className = "",
  variant = "primary",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonVariants({ variant, className })}
      {...props}
    />
  );
}
