import { useEffect, useRef } from "react";

import { releaseReservationLockByBeacon } from "@/lib/booking/api-client";

type UseBookingExitLockReleaseParams = {
  activeLockToken: string | null;
  releaseByBeacon?: (lockToken: string) => boolean;
};

export function useBookingExitLockRelease({
  activeLockToken,
  releaseByBeacon = releaseReservationLockByBeacon,
}: UseBookingExitLockReleaseParams) {
  const attemptedTokensRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!activeLockToken) {
      attemptedTokensRef.current.clear();
      return;
    }

    const onPageHide = () => {
      if (attemptedTokensRef.current.has(activeLockToken)) {
        return;
      }

      attemptedTokensRef.current.add(activeLockToken);
      releaseByBeacon(activeLockToken);
    };

    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [activeLockToken, releaseByBeacon]);
}
