import { useCallback, useEffect, useMemo, useState } from "react";

import type { DayAvailability } from "@/lib/availability/service";
import {
  alignDraftToSlot,
  getDatesForSlot,
  getSlotOptions,
} from "@/lib/booking/slot-search";
import type { BookingDraft } from "@/lib/booking/types";

export type ScheduleSearchMode = "day" | "time";

type UseBookingScheduleSearchParams = {
  days: DayAvailability[];
  draft: BookingDraft;
  onDraftChange: (nextDraft: Partial<BookingDraft>) => void;
};

export function useBookingScheduleSearch({
  days,
  draft,
  onDraftChange,
}: UseBookingScheduleSearchParams) {
  const [mode, setMode] = useState<ScheduleSearchMode>("day");
  const [searchSlot, setSearchSlot] = useState<string | null>(null);
  const slotOptions = useMemo(() => getSlotOptions(days), [days]);
  const activeSlot =
    mode === "time" && slotOptions.some((option) => option.slot === searchSlot)
      ? searchSlot
      : null;
  const enabledDates = useMemo(
    () =>
      mode === "time"
        ? new Set(activeSlot ? getDatesForSlot(days, activeSlot) : [])
        : null,
    [activeSlot, days, mode],
  );

  // Keeps the draft paired with the searched slot, e.g. after a month change.
  useEffect(() => {
    if (!activeSlot) {
      return;
    }

    const aligned = alignDraftToSlot(days, activeSlot, draft);
    if (aligned) {
      onDraftChange(aligned);
    }
  }, [activeSlot, days, draft, onDraftChange]);

  const changeMode = useCallback(
    (nextMode: ScheduleSearchMode) => {
      setMode(nextMode);
      if (nextMode === "time") {
        setSearchSlot(draft.timeSlot);
      }
    },
    [draft.timeSlot],
  );

  const selectSlot = useCallback(
    (slot: string) => {
      setSearchSlot(slot);
      const aligned = alignDraftToSlot(days, slot, draft);
      if (aligned) {
        onDraftChange(aligned);
      }
    },
    [days, draft, onDraftChange],
  );

  return {
    mode,
    changeMode,
    slotOptions,
    activeSlot,
    enabledDates,
    selectSlot,
    // In time mode there is no valid selection until a slot with days exists.
    canContinue: mode === "day" || activeSlot !== null,
  };
}
