export interface SwitchProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Switch({
  id,
  label,
  checked,
  onChange,
  disabled = false,
  className = "",
}: SwitchProps) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-[var(--admin-text-primary)]">
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-[var(--admin-border)] px-0.5 transition-colors duration-200 motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] disabled:cursor-not-allowed disabled:opacity-50 ${checked ? "bg-[var(--admin-accent)]" : "bg-[var(--admin-inactive-bg)]"}`}
      >
        <span
          aria-hidden="true"
          className={`inline-block h-4 w-4 rounded-full bg-[var(--admin-surface)] transition-transform duration-200 motion-reduce:transition-none ${checked ? "translate-x-[22px]" : "translate-x-0"}`}
        />
      </button>
    </div>
  );
}
