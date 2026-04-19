"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseClipboardCopyFeedbackParams = {
  durationMs?: number;
  onCopied?: () => void;
};

export function useClipboardCopyFeedback({
  durationMs = 3000,
  onCopied,
}: UseClipboardCopyFeedbackParams = {}) {
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const copy = useCallback(
    async (text: string) => {
      if (isCopied || !text) {
        return;
      }

      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      onCopied?.();

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        setIsCopied(false);
        timeoutRef.current = null;
      }, durationMs);
    },
    [durationMs, isCopied, onCopied],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isCopied,
    copy,
  };
}
