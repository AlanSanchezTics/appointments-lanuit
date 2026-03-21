import { useEffect, useRef, useState } from "react";

import type { SlotLock } from "@/lib/booking/types";

type UseBookingLockTimerParams = {
  activeLock: SlotLock | null;
  isActive: boolean;
  releaseLock: (lockToken: string) => Promise<void>;
  onExpired: () => void;
};

function getSecondsUntilExpiration(expiresAt: string) {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export function useBookingLockTimer({
  activeLock,
  isActive,
  releaseLock,
  onExpired,
}: UseBookingLockTimerParams) {
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const handledExpiredTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeLock || !isActive) {
      setRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      setRemainingSeconds(getSecondsUntilExpiration(activeLock.expiresAt));
    };

    updateRemaining();
    const interval = window.setInterval(updateRemaining, 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeLock, isActive]);

  useEffect(() => {
    if (!activeLock || !isActive) {
      handledExpiredTokenRef.current = null;
      return;
    }

    if (remainingSeconds > 0) {
      handledExpiredTokenRef.current = null;
      return;
    }

    if (handledExpiredTokenRef.current === activeLock.lockToken) {
      return;
    }

    handledExpiredTokenRef.current = activeLock.lockToken;

    let cancelled = false;

    void (async () => {
      await releaseLock(activeLock.lockToken).catch(() => undefined);

      if (!cancelled) {
        onExpired();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeLock, isActive, onExpired, releaseLock, remainingSeconds]);

  return {
    remainingSeconds,
    setRemainingSeconds,
  };
}
