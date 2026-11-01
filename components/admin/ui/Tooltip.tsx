"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { adminIcons } from "@/components/admin/ui/admin-icons";

export interface TooltipProps {
  // Nombre accesible del disparador (solo icono), p. ej. "Ayuda: conservar capacidad".
  label: string;
  children: ReactNode;
  // Ancla del globo respecto al disparador. "center" para disparadores junto a una etiqueta, en medio del contenedor.
  align?: "start" | "center" | "end";
}

const ALIGN_CLASSES: Record<NonNullable<TooltipProps["align"]>, string> = {
  start: "left-0",
  center: "left-1/2 -translate-x-1/2",
  end: "right-0",
};

// Ayuda contextual: abre con foco, clic/tap o puntero; cierra con blur, Escape o salida del puntero.
// El globo siempre está referenciado con aria-describedby (aunque esté oculto) para que el lector de pantalla lo anuncie al enfocar.
export function Tooltip({ label, children, align = "end" }: TooltipProps) {
  const tooltipId = useId();
  const [isOpen, setIsOpen] = useState(false);

  // Con el globo abierto, Escape solo lo cierra: se consume en captura para que BottomSheetModal (escucha en document) no cierre también el editor.
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function onKeyDownCapture(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDownCapture, true);

    return () => {
      document.removeEventListener("keydown", onKeyDownCapture, true);
    };
  }, [isOpen]);

  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-describedby={tooltipId}
        onClick={() => setIsOpen(true)}
        onFocus={() => setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full transition hover:bg-[var(--admin-inactive-bg)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)]"
      >
        <AdminIcon icon={adminIcons.info} tone="secondary" />
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        hidden={!isOpen}
        className={`absolute top-full z-10 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 text-xs font-medium leading-relaxed text-[var(--admin-text-primary)] shadow-sm ${ALIGN_CLASSES[align]}`}
      >
        {children}
      </span>
    </span>
  );
}
