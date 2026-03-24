"use client";

import { useEffect, useState } from "react";

import { AdminIcon } from "@/components/admin/ui/AdminIcon";
import { adminIcons } from "@/components/admin/ui/admin-icons";

type BottomSheetModalProps = {
  isOpen: boolean;
  title: string;
  closeLabel: string;
  onClose: () => void;
  disableClose?: boolean;
  children: React.ReactNode;
};

const EXIT_ANIMATION_MS = 260;

export function BottomSheetModal({
  isOpen,
  title,
  closeLabel,
  onClose,
  disableClose = false,
  children,
}: BottomSheetModalProps) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      setIsLeaving(false);
      return;
    }

    if (!isRendered) {
      return;
    }

    setIsLeaving(true);
    const timeout = window.setTimeout(() => {
      setIsRendered(false);
      setIsLeaving(false);
    }, EXIT_ANIMATION_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isOpen, isRendered]);

  useEffect(() => {
    if (!isRendered) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (disableClose) {
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [disableClose, isRendered, onClose]);

  if (!isRendered) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-[rgba(28,25,23,0.35)] px-0 backdrop-blur-sm sm:px-3">
      <button
        type="button"
        aria-label={closeLabel}
        className={`absolute inset-0 ${disableClose ? "cursor-not-allowed" : "cursor-default"}`}
        onClick={disableClose ? undefined : onClose}
        disabled={disableClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full max-w-[412px] rounded-t-3xl bg-[var(--admin-canvas)] shadow-2xl ${isLeaving ? "admin-sheet-leave" : "admin-sheet-enter"}`}
      >
        <div className="w-full pt-3">
          <div className="mx-auto h-1.5 w-14 rounded-full bg-[var(--admin-border)]" />
        </div>
        <div className="flex items-center justify-between px-6 pb-2 pt-5">
          <h2 className="text-[18px] font-bold leading-[1.05] text-[var(--admin-text-primary)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={disableClose ? undefined : onClose}
            aria-label={closeLabel}
            disabled={disableClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--admin-inactive-bg)] text-[var(--admin-text-secondary)] transition hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--admin-accent)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <AdminIcon icon={adminIcons.close} />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-6 pb-[3rem]">
          {children}
        </div>
      </section>
    </div>
  );
}
