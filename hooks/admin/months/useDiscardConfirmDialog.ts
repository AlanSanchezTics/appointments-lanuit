"use client";

import { useEffect, useId, useRef } from "react";

type UseDiscardConfirmDialogOptions = {
  isOpen: boolean;
  onKeepEditing: () => void;
};

// Confirmación "¿Descartar cambios?": foco inicial en el botón marcado con data-initial-focus,
// Esc = seguir editando, y al cerrarla el foco vuelve al elemento que lo tenía al abrirla.
export function useDiscardConfirmDialog({ isOpen, onKeepEditing }: UseDiscardConfirmDialogOptions) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLButtonElement>("[data-initial-focus]")?.focus();

    return () => {
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onKeepEditing();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onKeepEditing]);

  return { dialogRef, titleId, descriptionId };
}
