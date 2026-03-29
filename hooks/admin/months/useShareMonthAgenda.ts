"use client";

import { useCallback } from "react";

type ShareMonthAgendaResult = "copied" | "shared" | "cancelled" | "failed";

async function writeToClipboardWithNavigator(text: string): Promise<boolean> {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.clipboard?.writeText !== "function"
  ) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function writeToClipboardWithExecCommand(text: string): boolean {
  if (typeof document === "undefined") {
    return false;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let copied = false;

  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    textarea.remove();
  }

  return copied;
}

export function useShareMonthAgenda() {
  const shareMonthAgenda = useCallback(
    async (month: string): Promise<ShareMonthAgendaResult> => {
      if (typeof window === "undefined") {
        return "failed";
      }

      const publicMonthUrl = new URL(
        `/citas/${month}`,
        window.location.origin,
      ).toString();

      const copiedWithNavigator =
        await writeToClipboardWithNavigator(publicMonthUrl);
      if (copiedWithNavigator) {
        return "copied";
      }

      const copiedWithFallback = writeToClipboardWithExecCommand(publicMonthUrl);
      if (copiedWithFallback) {
        return "copied";
      }

      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ url: publicMonthUrl });
          return "shared";
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            return "cancelled";
          }
        }
      }

      return "failed";
    },
    [],
  );

  return {
    shareMonthAgenda,
  };
}
