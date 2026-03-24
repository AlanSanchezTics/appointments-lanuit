import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BlockSpacesModal } from "@/components/admin/months/BlockSpacesModal";

describe("BlockSpacesModal", () => {
  it("triggers select all when toggle is unchecked", () => {
    const onClose = vi.fn();
    const onRetry = vi.fn();
    const onSelectDate = vi.fn();
    const onToggleSlot = vi.fn();
    const onSelectAllSlots = vi.fn();
    const onClearSelectedSlots = vi.fn();
    const onReasonChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <BlockSpacesModal
        isOpen
        isLoadingDays={false}
        isSubmitting={false}
        isReadyToSubmit
        errorCode={null}
        days={[
          {
            date: "2026-03-23",
            slots: ["09:00", "10:00", "13:00"],
          },
        ]}
        selectedDate="2026-03-23"
        currentDate="2026-03-23"
        selectedDaySlots={["09:00", "10:00", "13:00"]}
        selectedSlots={["09:00"]}
        areAllSelectedForDay={false}
        reason="DESCANSO"
        onClose={onClose}
        onRetry={onRetry}
        onSelectDate={onSelectDate}
        onToggleSlot={onToggleSlot}
        onSelectAllSlots={onSelectAllSlots}
        onClearSelectedSlots={onClearSelectedSlots}
        onReasonChange={onReasonChange}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Bloquear todo el día/i }));

    expect(onSelectAllSlots).toHaveBeenCalledTimes(1);
    expect(onClearSelectedSlots).not.toHaveBeenCalled();
  });

  it("triggers clear selection when toggle is checked", () => {
    const onClose = vi.fn();
    const onRetry = vi.fn();
    const onSelectDate = vi.fn();
    const onToggleSlot = vi.fn();
    const onSelectAllSlots = vi.fn();
    const onClearSelectedSlots = vi.fn();
    const onReasonChange = vi.fn();
    const onSubmit = vi.fn();

    render(
      <BlockSpacesModal
        isOpen
        isLoadingDays={false}
        isSubmitting={false}
        isReadyToSubmit
        errorCode={null}
        days={[
          {
            date: "2026-03-23",
            slots: ["09:00", "10:00", "13:00"],
          },
        ]}
        selectedDate="2026-03-23"
        currentDate="2026-03-23"
        selectedDaySlots={["09:00", "10:00", "13:00"]}
        selectedSlots={["09:00", "10:00", "13:00"]}
        areAllSelectedForDay
        reason="DESCANSO"
        onClose={onClose}
        onRetry={onRetry}
        onSelectDate={onSelectDate}
        onToggleSlot={onToggleSlot}
        onSelectAllSlots={onSelectAllSlots}
        onClearSelectedSlots={onClearSelectedSlots}
        onReasonChange={onReasonChange}
        onSubmit={onSubmit}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Bloquear todo el día/i }));

    expect(onSelectAllSlots).not.toHaveBeenCalled();
    expect(onClearSelectedSlots).toHaveBeenCalledTimes(1);
  });
});
