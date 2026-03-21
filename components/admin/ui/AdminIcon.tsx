import type { IconProp, SizeProp } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const toneClassName = {
  accent: "text-[var(--admin-accent)]",
  secondary: "text-[var(--admin-text-secondary)]",
  primary: "text-[var(--admin-text-primary)]",
} as const;

export interface AdminIconProps {
  icon: IconProp;
  tone?: keyof typeof toneClassName;
  size?: SizeProp;
  className?: string;
  title?: string;
}

export function AdminIcon({
  icon,
  tone = "accent",
  size = "sm",
  className,
  title,
}: AdminIconProps) {
  const mergedClassName = [toneClassName[tone], className]
    .filter(Boolean)
    .join(" ");

  return (
    <FontAwesomeIcon
      icon={icon}
      size={size}
      title={title}
      className={mergedClassName}
      aria-hidden={title ? undefined : true}
      focusable={false}
    />
  );
}
