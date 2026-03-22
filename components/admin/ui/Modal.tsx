"use client";

import { useEffect, useRef } from "react";

import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { adminIcons } from "@/components/admin/ui/admin-icons";

type ModalProps = {
  isOpen: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: React.ReactNode;
};

function findFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((node) => !node.hasAttribute("disabled"));
}

export function Modal({ isOpen, title, closeLabel, onClose, children }: ModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const container = containerRef.current;

    if (!container) {
      return;
    }

    const focusableElements = findFocusableElements(container);
    const first = focusableElements[0];
    first?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusable = findFocusableElements(container);

      if (focusable.length === 0) {
        return;
      }

      const firstFocusable = focusable[0];
      const lastFocusable = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && activeElement === firstFocusable) {
        event.preventDefault();
        lastFocusable.focus();
      }

      if (!event.shiftKey && activeElement === lastFocusable) {
        event.preventDefault();
        firstFocusable.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(28,25,23,0.35)] px-3 py-6 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={containerRef}
        className="w-full max-w-[412px] rounded-xl bg-[var(--admin-surface)] p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-[var(--admin-text-primary)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--admin-text-secondary)] hover:bg-[var(--admin-inactive-bg)] hover:text-[var(--admin-text-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)]"
          >
            <AdminIcon icon={adminIcons.close} tone="secondary" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
